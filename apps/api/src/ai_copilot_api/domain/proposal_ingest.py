"""Single apply layer used by the PDF flow (Phase 2) and JSON ingest (Phase 4+).

`apply_proposal_to_opportunity` is the only place that writes a canonical
proposal payload onto an `Opportunity` and enriches the linked party
(`Client` or `Lead`). It enforces the policies defined in
`docs/ADR-PROPOSAL-INGEST.md`:

- §D5 idempotency keys: `(insurer_name, quote_number, quote_item)` are kept
  consistent on the opportunity so the partial unique index can take effect.
- §D6 no-overwrite policy: existing scalar fields on the party (full_name,
  email, phone, ...) and existing fields inside `profile_data` blocks are
  preserved; missing values are populated.
- §D6 mobility upsert (AUTO only): vehicles are merged into
  `profile_data.mobility.vehicles[]` keyed by `chassis` (preferred) or
  `plate`. The `owns_vehicle` legacy flag is set to `True` when at least one
  vehicle is present and the field was `None`. Non-AUTO lines (Life, Home,
  Business) skip the mobility merge — the canonical envelope is still
  written to ``Opportunity.proposal_data`` and the opportunity columns are
  updated.
- §D8: `ClientHeldProduct` is intentionally NOT created here.
- All material changes (party scalars, opportunity columns) emit append-only
  audit events through `domain.crm_audit`.

Re-applying the same payload to the same opportunity is a no-op (no audit
events recorded), which gives us idempotency end-to-end.

`apply_auto_proposal_to_opportunity` is kept as a backward-compatible alias
for callers that still pass an :class:`AutoProposalPayload` explicitly.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ai_copilot_api.db.enums import (
    CrmAuditAction,
    CrmEntityType,
    ProductCategory,
)
from ai_copilot_api.db.models import (
    Client,
    Insurer,
    Lead,
    Opportunity,
    Product,
)
from ai_copilot_api.domain.client_profile import (
    coerce_profile_dict,
    merge_profile_dict,
)
from ai_copilot_api.domain.crm_audit import record_audit, record_field_updates
from ai_copilot_api.schemas.client_profile import ClientProfileVehicle
from ai_copilot_api.schemas.proposal_ingest import (
    AutoProposalPayload,
    ProposalApplicant,
    ProposalPayload,
    ProposalVehicle,
)

Party = Client | Lead

# Type alias re-exported for callers that want a single name for any line.
AnyProposalPayload = ProposalPayload


_TAX_ID_NON_DIGITS = re.compile(r"\D+")


def normalize_tax_id(raw: str | None) -> str | None:
    """Return digits-only CPF/CNPJ. Empty input -> None."""
    if raw is None:
        return None
    digits = _TAX_ID_NON_DIGITS.sub("", str(raw))
    if not digits:
        return None
    return digits


def _normalize_plate(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = re.sub(r"[\s-]+", "", str(value)).upper()
    return cleaned or None


def _normalize_chassis(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = re.sub(r"\s+", "", str(value)).upper()
    return cleaned or None


@dataclass(frozen=True)
class ApplyResult:
    """Summary of what changed during `apply_auto_proposal_to_opportunity`."""

    opportunity_id: uuid.UUID
    party_id: uuid.UUID
    party_kind: str  # "client" | "lead"
    opportunity_changes: dict[str, Any] = field(default_factory=dict)
    profile_changes: dict[str, Any] = field(default_factory=dict)
    party_scalar_changes: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Party resolution
# ---------------------------------------------------------------------------


def resolve_party(
    db: Session,
    organization_id: uuid.UUID,
    applicant: ProposalApplicant,
    *,
    opportunity: Opportunity | None = None,
) -> Party:
    """Locate a `Client`/`Lead` for the proposal applicant.

    Lookup order:
    1. The opportunity's already-linked party (PDF channel always has one).
    2. By normalized `tax_id` against `Client.company_tax_id` /
       `Client.external_id`, then against `Lead.company_tax_id` /
       `Lead.external_id`, scoped to the organization.

    Raises `LookupError` when no match is found. Anonymous applicants are not
    accepted (ADR §D7); the caller decides whether to create a new lead
    (Phase 4 / JSON channel) or surface the error to the user.
    """
    if opportunity is not None:
        if opportunity.client_id is not None:
            row = db.scalar(
                select(Client).where(
                    Client.id == opportunity.client_id,
                    Client.organization_id == organization_id,
                ),
            )
            if row is not None:
                return row
        if opportunity.lead_id is not None:
            row = db.scalar(
                select(Lead).where(
                    Lead.id == opportunity.lead_id,
                    Lead.organization_id == organization_id,
                ),
            )
            if row is not None:
                return row

    tax_id = normalize_tax_id(applicant.tax_id)
    if tax_id is None:
        raise LookupError("Applicant tax_id is required to resolve a party")

    client_row = db.scalar(
        select(Client).where(
            Client.organization_id == organization_id,
            (Client.company_tax_id == tax_id) | (Client.external_id == tax_id),
        ),
    )
    if client_row is not None:
        return client_row

    lead_row = db.scalar(
        select(Lead).where(
            Lead.organization_id == organization_id,
            (Lead.company_tax_id == tax_id) | (Lead.external_id == tax_id),
        ),
    )
    if lead_row is not None:
        return lead_row

    raise LookupError(
        f"No client or lead found for tax_id={tax_id!r} in this organization",
    )


def find_opportunity_by_quote_tuple(
    db: Session,
    organization_id: uuid.UUID,
    *,
    preferred_insurer_name: str,
    quote_number: str,
    quote_item: int,
) -> Opportunity | None:
    """Return an opportunity matching ADR §D5 idempotency (insurer name case-insensitive)."""
    name = (preferred_insurer_name or "").strip()
    qn = (quote_number or "").strip()
    if not name or not qn:
        return None
    return db.scalar(
        select(Opportunity).where(
            Opportunity.organization_id == organization_id,
            func.lower(Opportunity.preferred_insurer_name) == name.lower(),
            Opportunity.quote_number == qn,
            Opportunity.quote_item == quote_item,
        ),
    )


def applicant_matches_party(party: Party, applicant: ProposalApplicant) -> bool:
    """True when the applicant's normalized tax id matches the party's stored identifiers."""
    tax = normalize_tax_id(applicant.tax_id)
    if tax is None:
        return False
    cid = party.company_tax_id
    eid = party.external_id
    return cid == tax or eid == tax


def create_lead_from_applicant(
    db: Session,
    *,
    organization_id: uuid.UUID,
    applicant: ProposalApplicant,
    owner_id: uuid.UUID,
) -> Lead:
    """Create a `Lead` for JSON ingest when no existing party matches (ADR §D7)."""
    tax = normalize_tax_id(applicant.tax_id)
    if tax is None:
        raise ValueError("Applicant tax_id is required to create a lead")
    email_out: str | None = None
    if applicant.email and str(applicant.email).strip():
        email_out = str(applicant.email).strip()
    row = Lead(
        organization_id=organization_id,
        full_name=applicant.full_name.strip(),
        email=email_out,
        phone=applicant.phone,
        date_of_birth=applicant.date_of_birth,
        company_tax_id=tax,
        external_id=tax,
        owner_id=owner_id,
        source="proposal_json_ingest",
        profile_data={},
    )
    db.add(row)
    db.flush()
    return row


# ---------------------------------------------------------------------------
# Insurer / product resolution
# ---------------------------------------------------------------------------


def resolve_insurer(
    db: Session,
    organization_id: uuid.UUID,
    name: str | None,
    *,
    auto_create: bool = False,
) -> Insurer | None:
    """Lookup `Insurer` by case-insensitive name; optionally auto-create."""
    if name is None or not name.strip():
        return None
    normalized = name.strip()
    row = db.scalar(
        select(Insurer).where(
            Insurer.organization_id == organization_id,
            Insurer.name.ilike(normalized),
        ),
    )
    if row is not None or not auto_create:
        return row
    row = Insurer(
        organization_id=organization_id,
        name=normalized,
        active=True,
    )
    db.add(row)
    db.flush()
    return row


def resolve_product(
    db: Session,
    organization_id: uuid.UUID,
    insurer: Insurer | None,
    product_name: str | None,
    insurance_line: ProductCategory,
) -> Product | None:
    """Lookup an active `Product` by name, scoped to insurer and category."""
    if product_name is None or not product_name.strip():
        return None
    stmt = select(Product).where(
        Product.organization_id == organization_id,
        Product.category == insurance_line,
        Product.active.is_(True),
        Product.name.ilike(product_name.strip()),
    )
    if insurer is not None:
        stmt = stmt.where(Product.insurer_id == insurer.id)
    return db.scalar(stmt)


# ---------------------------------------------------------------------------
# Profile merge — no-overwrite policy
# ---------------------------------------------------------------------------


def _fill_missing(target: dict[str, Any], block_key: str, patch: dict[str, Any]) -> bool:
    """Populate empty (None / missing) fields in `target[block_key]`. Returns True if changed."""
    block_existing = target.get(block_key) if isinstance(target.get(block_key), dict) else {}
    block = dict(block_existing)
    changed = False
    for k, v in patch.items():
        if v is None:
            continue
        if block.get(k) in (None, "", []):
            block[k] = v
            changed = True
    if changed:
        target[block_key] = block
    return changed


def _vehicle_patch_from_proposal(
    payload: AutoProposalPayload,
) -> dict[str, Any]:
    veh: ProposalVehicle = payload.vehicle
    quote = payload.quote
    quoted_at: date | None = None
    if quote.calculated_at is not None:
        quoted_at = quote.calculated_at.date()
    elif quote.valid_until is not None:
        quoted_at = quote.valid_until

    plate = _normalize_plate(veh.plate)
    chassis = _normalize_chassis(veh.chassis)
    return ClientProfileVehicle(
        make=veh.make,
        model=veh.model,
        version=veh.version,
        fabrication_year=veh.fabrication_year,
        model_year=veh.model_year,
        plate=plate,
        chassis=chassis,
        fipe_code=veh.fipe_code,
        usage=veh.usage,
        fuel_type=veh.fuel_type,
        body_type=veh.body_type,
        last_quote_number=quote.number,
        last_quoted_at=quoted_at,
    ).model_dump(mode="json", exclude_none=True)


def _vehicles_match(existing: dict[str, Any], incoming: dict[str, Any]) -> bool:
    inc_chassis = incoming.get("chassis")
    if inc_chassis and existing.get("chassis") == inc_chassis:
        return True
    inc_plate = incoming.get("plate")
    if inc_plate and existing.get("plate") == inc_plate:
        return True
    return False


def _upsert_vehicle(
    mobility_block: dict[str, Any],
    incoming: dict[str, Any],
) -> tuple[dict[str, Any], bool]:
    """No-overwrite upsert into `mobility.vehicles[]`. Returns (block, changed)."""
    block = dict(mobility_block) if mobility_block else {}
    existing_list_raw = block.get("vehicles")
    existing_list: list[dict[str, Any]] = (
        [dict(v) for v in existing_list_raw if isinstance(v, dict)]
        if isinstance(existing_list_raw, list)
        else []
    )
    target_idx: int | None = None
    for idx, v in enumerate(existing_list):
        if _vehicles_match(v, incoming):
            target_idx = idx
            break

    changed = False
    if target_idx is None:
        existing_list.append(incoming)
        changed = True
    else:
        merged = dict(existing_list[target_idx])
        for k, v in incoming.items():
            if v is None:
                continue
            if merged.get(k) in (None, "", []):
                merged[k] = v
                changed = True
        if changed:
            existing_list[target_idx] = merged

    if changed:
        block["vehicles"] = existing_list
        if block.get("owns_vehicle") is None and existing_list:
            block["owns_vehicle"] = True
            changed = True
        if block.get("vehicle_count") is None:
            block["vehicle_count"] = len(existing_list)
            changed = True

    return block, changed


def merge_personal_block(
    profile_data: dict[str, Any],
    payload: ProposalPayload,
) -> tuple[dict[str, Any], bool]:
    """Merge applicant fields into `personal` / `professional` blocks.

    Pure helper: does not mutate `profile_data`. Returns (new_profile, changed).
    Works for any line — only reads from the shared
    :class:`ProposalApplicant` envelope.
    """
    out = dict(profile_data or {})
    applicant = payload.applicant
    personal_patch: dict[str, Any] = {}
    if applicant.marital_status:
        personal_patch["marital_status"] = applicant.marital_status
    changed_personal = False
    if personal_patch:
        changed_personal = _fill_missing(out, "personal", personal_patch)

    return out, changed_personal


def merge_mobility_block(
    profile_data: dict[str, Any],
    payload: AutoProposalPayload,
) -> tuple[dict[str, Any], bool]:
    """Upsert the proposal vehicle into `mobility.vehicles[]`.

    Pure helper: does not mutate `profile_data`. Returns (new_profile, changed).
    """
    out = dict(profile_data or {})
    incoming_vehicle = _vehicle_patch_from_proposal(payload)
    if not incoming_vehicle:
        return out, False
    mobility_block = out.get("mobility") if isinstance(out.get("mobility"), dict) else {}
    new_block, changed = _upsert_vehicle(mobility_block, incoming_vehicle)
    if changed:
        out = merge_profile_dict(out, {"mobility": new_block})
    return out, changed


# ---------------------------------------------------------------------------
# Audit trail
# ---------------------------------------------------------------------------


def _entity_type_for_party(party: Party) -> CrmEntityType:
    return CrmEntityType.CLIENT if isinstance(party, Client) else CrmEntityType.LEAD


def apply_audit_trail(
    db: Session,
    *,
    organization_id: uuid.UUID,
    actor_user_id: uuid.UUID,
    party: Party,
    opportunity: Opportunity,
    party_scalar_before: dict[str, Any],
    party_scalar_after: dict[str, Any],
    profile_changed: bool,
    opportunity_before: dict[str, Any],
    opportunity_after: dict[str, Any],
) -> None:
    """Emit append-only audit events for the apply step (party + opportunity)."""
    record_field_updates(
        db,
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type=_entity_type_for_party(party),
        entity_id=party.id,
        before=party_scalar_before,
        updates=party_scalar_after,
    )
    if profile_changed:
        record_audit(
            db,
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            entity_type=_entity_type_for_party(party),
            entity_id=party.id,
            action=CrmAuditAction.UPDATE,
            field_name="profile_data",
            old_value=None,
            new_value="merged_from_proposal",
        )
    record_field_updates(
        db,
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type=CrmEntityType.OPPORTUNITY,
        entity_id=opportunity.id,
        before=opportunity_before,
        updates=opportunity_after,
    )


# ---------------------------------------------------------------------------
# Apply
# ---------------------------------------------------------------------------


_OPP_TRACKED_FIELDS: tuple[str, ...] = (
    "insurance_line",
    "proposal_source",
    "preferred_insurer_name",
    "quote_number",
    "quote_item",
    "quote_valid_until",
    "estimated_value",
)


def _apply_party_scalar(party: Party, applicant: ProposalApplicant) -> dict[str, Any]:
    """No-overwrite update of party scalars. Returns updates actually applied."""
    updates: dict[str, Any] = {}
    if not (party.email and party.email.strip()) and applicant.email:
        party.email = applicant.email
        updates["email"] = applicant.email
    if not (party.phone and party.phone.strip()) and applicant.phone:
        party.phone = applicant.phone
        updates["phone"] = applicant.phone
    if party.date_of_birth is None and applicant.date_of_birth is not None:
        party.date_of_birth = applicant.date_of_birth
        updates["date_of_birth"] = applicant.date_of_birth
    if party.company_tax_id is None:
        normalized = normalize_tax_id(applicant.tax_id)
        if normalized:
            party.company_tax_id = normalized
            updates["company_tax_id"] = normalized
    return updates


def _apply_opportunity_columns(
    opp: Opportunity,
    payload: ProposalPayload,
    *,
    proposal_source: str,
) -> dict[str, Any]:
    """Set canonical columns on the opportunity. Returns the new values dict.

    Works for any line in :data:`ProposalPayload` — every payload class shares
    the canonical envelope (``quote``, ``premium``, ``insurance_line``).
    """
    quote = payload.quote
    premium = payload.premium

    new_values: dict[str, Any] = {
        "insurance_line": payload.insurance_line,
        "proposal_source": proposal_source,
        "preferred_insurer_name": quote.insurer_name,
        "quote_number": quote.number,
        "quote_item": quote.item if quote.number is not None else None,
        "quote_valid_until": quote.valid_until,
    }
    estimated = premium.total_payable if premium.total_payable is not None else premium.total
    if isinstance(estimated, Decimal):
        new_values["estimated_value"] = estimated

    for k, v in new_values.items():
        setattr(opp, k, v)
    opp.proposal_data = payload.model_dump(mode="json")
    return new_values


def _opportunity_snapshot(opp: Opportunity) -> dict[str, Any]:
    snap: dict[str, Any] = {}
    for f in _OPP_TRACKED_FIELDS:
        snap[f] = getattr(opp, f)
    return snap


def apply_proposal_to_opportunity(
    db: Session,
    *,
    opportunity: Opportunity,
    payload: ProposalPayload,
    proposal_source: str,
    actor_user_id: uuid.UUID,
    party: Party | None = None,
) -> ApplyResult:
    """Persist a canonical proposal onto the opportunity (any line).

    Side effects (single transaction; commit is the caller's responsibility):
    - Resolves the linked party (`Client` or `Lead`) when not provided.
    - Updates `Opportunity` columns + `proposal_data` (idempotent).
    - Enriches `party.profile_data`:
        * AUTO → personal + mobility (vehicles) blocks.
        * Life / Home / Business → personal block only; line-specific blocks
          (group, subject, …) live inside ``proposal_data`` and are not
          merged into ``profile_data`` until per-line merge rules ship.
    - Updates a few party scalars under the no-overwrite policy.
    - Emits append-only audit events for both party and opportunity.

    Idempotency: applying the same payload twice produces no further audit
    events because `record_field_updates` skips equal old/new values.
    """
    organization_id = opportunity.organization_id
    if party is None:
        party = resolve_party(
            db,
            organization_id,
            payload.applicant,
            opportunity=opportunity,
        )

    party_scalar_before: dict[str, Any] = {
        "email": party.email,
        "phone": party.phone,
        "date_of_birth": party.date_of_birth,
        "company_tax_id": party.company_tax_id,
    }
    party_scalar_updates = _apply_party_scalar(party, payload.applicant)

    profile_existing = coerce_profile_dict(party.profile_data)
    profile_after, personal_changed = merge_personal_block(profile_existing, payload)
    mobility_changed = False
    if isinstance(payload, AutoProposalPayload):
        profile_after, mobility_changed = merge_mobility_block(profile_after, payload)
    profile_changed = personal_changed or mobility_changed
    if profile_changed:
        party.profile_data = profile_after

    opp_before = _opportunity_snapshot(opportunity)
    opp_after = _apply_opportunity_columns(
        opportunity,
        payload,
        proposal_source=proposal_source,
    )

    apply_audit_trail(
        db,
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        party=party,
        opportunity=opportunity,
        party_scalar_before=party_scalar_before,
        party_scalar_after=party_scalar_updates,
        profile_changed=profile_changed,
        opportunity_before=opp_before,
        opportunity_after=opp_after,
    )

    party_kind = "client" if isinstance(party, Client) else "lead"
    return ApplyResult(
        opportunity_id=opportunity.id,
        party_id=party.id,
        party_kind=party_kind,
        opportunity_changes={
            k: v for k, v in opp_after.items() if opp_before.get(k) != v
        },
        profile_changes={
            "personal_changed": personal_changed,
            "mobility_changed": mobility_changed,
        },
        party_scalar_changes=party_scalar_updates,
    )


# Backward-compatible alias — kept because it is imported across the API
# surface (routes_proposal_ingest, routes_document_extraction,
# routes_opportunities) and explicitly typed against AutoProposalPayload.
def apply_auto_proposal_to_opportunity(
    db: Session,
    *,
    opportunity: Opportunity,
    payload: AutoProposalPayload,
    proposal_source: str,
    actor_user_id: uuid.UUID,
    party: Party | None = None,
) -> ApplyResult:
    """Apply an AUTO proposal — alias for :func:`apply_proposal_to_opportunity`."""
    return apply_proposal_to_opportunity(
        db,
        opportunity=opportunity,
        payload=payload,
        proposal_source=proposal_source,
        actor_user_id=actor_user_id,
        party=party,
    )


__all__ = [
    "AnyProposalPayload",
    "ApplyResult",
    "Party",
    "applicant_matches_party",
    "apply_audit_trail",
    "apply_auto_proposal_to_opportunity",
    "apply_proposal_to_opportunity",
    "create_lead_from_applicant",
    "find_opportunity_by_quote_tuple",
    "merge_mobility_block",
    "merge_personal_block",
    "normalize_tax_id",
    "resolve_insurer",
    "resolve_party",
    "resolve_product",
]
