"""Phase 4 — JSON proposal ingest (partner / broker channel, ADR §D2).

Phase 9 — the channel is line-agnostic: the adapter's ``insurance_line``
selects the canonical Pydantic class via ``select_proposal_payload_class``
and the apply step dispatches to AUTO mobility merge only when the payload
is an :class:`AutoProposalPayload`. The legacy ``/v1/proposals/auto/*``
URLs are kept as-is and behave correctly for any line; new line-neutral
``/v1/proposals/*`` routes are exposed so callers can migrate gradually.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ai_copilot_api.api.deps import require_broker_or_above
from ai_copilot_api.db.enums import (
    CrmEntityType,
    OpportunityStage,
    OpportunityStatus,
)
from ai_copilot_api.db.models import Client, Lead, Opportunity, User
from ai_copilot_api.db.session import get_db
from ai_copilot_api.domain.crm_audit import record_entity_snapshot_create
from ai_copilot_api.domain.opportunity_status import status_for_stage
from ai_copilot_api.domain.proposal_adapters import select_adapter_for_json
from ai_copilot_api.domain.proposal_ingest import (
    applicant_matches_party,
    apply_proposal_to_opportunity,
    create_lead_from_applicant,
    find_opportunity_by_quote_tuple,
    resolve_party,
)
from ai_copilot_api.schemas.proposal_ingest import (
    ProposalAutoIngestBody,
    ProposalIngestPreviewOut,
    ProposalIngestResultOut,
    ProposalPayload,
    select_proposal_payload_class,
)

router = APIRouter(prefix="/proposals", tags=["proposals"])


def _validation_errors_payload(exc: ValidationError) -> list[dict[str, Any]]:
    return [
        {
            "loc": list(err.get("loc", ())),
            "msg": err.get("msg"),
            "type": err.get("type"),
        }
        for err in exc.errors()
    ]


def _resolve_owner_id(
    db: Session,
    org_id: uuid.UUID,
    current_user: User,
    owner_id: uuid.UUID | None,
) -> uuid.UUID:
    if owner_id is None:
        return current_user.id
    u = db.scalar(select(User).where(User.id == owner_id, User.organization_id == org_id))
    if u is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Owner user not found")
    return owner_id


def _adapt_and_validate(
    body: ProposalAutoIngestBody,
) -> tuple[Any, ProposalPayload | None, list[dict[str, Any]]]:
    """Return (adapter_instance, payload_or_none, validation_errors).

    The canonical Pydantic class is chosen from ``adapter.insurance_line``
    (with ``subject_kind`` peeked from the canonical dict for the
    ``GENERAL_INSURANCE`` line). Lines without a canonical class yet
    (currently only HEALTH_INSURANCE) bubble up as a clean 422.
    """
    try:
        adapter = select_adapter_for_json(body.source)
    except NotImplementedError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "UNKNOWN_PROPOSAL_SOURCE", "message": str(exc)},
        ) from exc
    canonical_dict = adapter.to_canonical_dict(body.payload)
    subject_kind = canonical_dict.get("subject_kind")
    if subject_kind not in (None, "home", "business"):
        subject_kind = None
    try:
        payload_cls = select_proposal_payload_class(
            adapter.insurance_line,
            subject_kind=subject_kind,  # type: ignore[arg-type]
        )
    except NotImplementedError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "UNSUPPORTED_INSURANCE_LINE",
                "message": str(exc),
            },
        ) from exc
    try:
        payload = payload_cls.model_validate(canonical_dict)
        return adapter, payload, []
    except ValidationError as exc:
        return adapter, None, _validation_errors_payload(exc)


def _require_quote_number(payload: ProposalPayload) -> tuple[str, int, str]:
    """Return (insurer_name, quote_item, quote_number_stripped) or raise 422."""
    q = payload.quote
    if q.number is None or not str(q.number).strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "PROPOSAL_QUOTE_NUMBER_REQUIRED",
                "message": "quote.number is required for JSON ingest idempotency",
            },
        )
    insurer = (q.insurer_name or "").strip()
    if not insurer:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "PROPOSAL_INSURER_NAME_REQUIRED",
                "message": "quote.insurer_name is required when quote.number is set",
            },
        )
    return insurer, q.item, str(q.number).strip()


def _snapshot_lead_for_audit(lead: Lead) -> dict[str, Any]:
    return {
        "full_name": lead.full_name,
        "email": lead.email,
        "phone": lead.phone,
        "date_of_birth": lead.date_of_birth,
        "external_id": lead.external_id,
        "source": lead.source,
        "notes": lead.notes,
        "owner_id": lead.owner_id,
        "status": lead.status.value,
        "client_kind": lead.client_kind.value,
        "company_legal_name": lead.company_legal_name,
        "company_tax_id": lead.company_tax_id,
        "marketing_opt_in": lead.marketing_opt_in,
        "preferred_marketing_channel": lead.preferred_marketing_channel,
    }


@router.post("/auto/preview", response_model=ProposalIngestPreviewOut)
def preview_auto_proposal(
    body: ProposalAutoIngestBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_broker_or_above),
) -> ProposalIngestPreviewOut:
    """Dry-run: validate and resolve idempotency / party without persisting."""
    org_id = current_user.organization_id
    adapter, payload, validation_errors = _adapt_and_validate(body)
    if payload is None:
        return ProposalIngestPreviewOut(
            proposal_source=getattr(adapter, "source", body.source),
            payload=None,
            confidence=0,
            requires_review=True,
            validation_errors=validation_errors,
            extraction_meta={"channel": "json_preview"},
        )

    insurer_name, quote_item, quote_number = _require_quote_number(payload)
    existing = find_opportunity_by_quote_tuple(
        db,
        org_id,
        preferred_insurer_name=insurer_name,
        quote_number=quote_number,
        quote_item=quote_item,
    )

    party: Client | Lead | None = None
    party_kind: str | None = None
    would_create_lead = False
    try:
        party = resolve_party(db, org_id, payload.applicant, opportunity=existing)
        party_kind = "client" if isinstance(party, Client) else "lead"
    except LookupError:
        if not body.create_lead_if_missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={
                    "code": "NO_MATCHING_PARTY",
                    "message": (
                        "No client or lead matches the applicant tax id; "
                        "enable create_lead_if_missing or link an existing party first."
                    ),
                },
            )
        would_create_lead = True

    return ProposalIngestPreviewOut(
        opportunity_id=existing.id if existing else None,
        party_id=party.id if party else None,
        party_kind=party_kind,  # type: ignore[arg-type]
        would_create_lead=would_create_lead,
        proposal_source=adapter.source,
        payload=payload,
        confidence=100,
        requires_review=False,
        validation_errors=[],
        extraction_meta={"channel": "json_preview"},
    )


@router.post("/auto/commit", response_model=ProposalIngestResultOut)
def commit_auto_proposal(
    body: ProposalAutoIngestBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_broker_or_above),
) -> ProposalIngestResultOut:
    """Persist canonical auto proposal: upsert by quote tuple, create `Lead` when needed."""
    org_id = current_user.organization_id
    adapter, payload, validation_errors = _adapt_and_validate(body)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "CANONICAL_VALIDATION_ERROR",
                "errors": validation_errors,
            },
        )

    insurer_name, quote_item, quote_number = _require_quote_number(payload)
    existing = find_opportunity_by_quote_tuple(
        db,
        org_id,
        preferred_insurer_name=insurer_name,
        quote_number=quote_number,
        quote_item=quote_item,
    )
    owner_uid = _resolve_owner_id(db, org_id, current_user, body.owner_id)
    proposal_source = adapter.source

    if existing is not None:
        party = resolve_party(db, org_id, payload.applicant, opportunity=existing)
        if not applicant_matches_party(party, payload.applicant):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "PROPOSAL_INGEST_PARTY_MISMATCH",
                    "message": (
                        "Applicant tax id does not match the client or lead linked to the "
                        "existing opportunity for this quote."
                    ),
                },
            )
        apply_proposal_to_opportunity(
            db,
            opportunity=existing,
            payload=payload,
            proposal_source=proposal_source,
            actor_user_id=current_user.id,
            party=party,
        )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "PROPOSAL_QUOTE_CONFLICT",
                    "message": (
                        "Could not save proposal due to a conflicting quote row; "
                        "retry or fetch the opportunity."
                    ),
                },
            ) from None
        db.refresh(existing)
        return ProposalIngestResultOut(
            opportunity_id=existing.id,
            party_id=party.id,
            party_kind="client" if isinstance(party, Client) else "lead",  # type: ignore[arg-type]
            proposal_source=proposal_source,
            payload=payload,
            confidence=100,
            requires_review=False,
            validation_errors=[],
            extraction_meta={"channel": "json_commit"},
            applied=True,
        )

    party_resolved: Client | Lead
    party_resolved: Client | Lead
    try:
        party_resolved = resolve_party(db, org_id, payload.applicant, opportunity=None)
    except LookupError:
        if not body.create_lead_if_missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={
                    "code": "NO_MATCHING_PARTY",
                    "message": (
                        "No client or lead matches the applicant tax id; "
                        "set create_lead_if_missing=true to create a lead automatically."
                    ),
                },
            )
        try:
            party_resolved = create_lead_from_applicant(
                db,
                organization_id=org_id,
                applicant=payload.applicant,
                owner_id=owner_uid,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={
                    "code": "PROPOSAL_INGEST_APPLICANT_TAX_ID_REQUIRED",
                    "message": str(exc),
                },
            ) from exc
        record_entity_snapshot_create(
            db,
            organization_id=org_id,
            actor_user_id=current_user.id,
            entity_type=CrmEntityType.LEAD,
            entity_id=party_resolved.id,
            snapshot=_snapshot_lead_for_audit(party_resolved),
        )

    quote = payload.quote
    opp = Opportunity(
        organization_id=org_id,
        client_id=party_resolved.id if isinstance(party_resolved, Client) else None,
        lead_id=party_resolved.id if isinstance(party_resolved, Lead) else None,
        owner_id=owner_uid,
        product_id=None,
        insurance_line=payload.insurance_line,
        closing_probability=0,
        stage=OpportunityStage.LEAD,
        status=status_for_stage(OpportunityStage.LEAD, OpportunityStatus.OPEN),
        preferred_insurer_name=quote.insurer_name,
        quote_number=quote_number,
        quote_item=quote.item,
        proposal_source=proposal_source,
        quote_valid_until=quote.valid_until,
        proposal_data=None,
    )
    db.add(opp)
    db.flush()

    apply_proposal_to_opportunity(
        db,
        opportunity=opp,
        payload=payload,
        proposal_source=proposal_source,
        actor_user_id=current_user.id,
        party=party_resolved,
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "PROPOSAL_QUOTE_CONFLICT",
                "message": (
                    "Quote id already exists in this organization; "
                    "fetch or update the existing opportunity."
                ),
            },
        ) from None

    db.refresh(opp)
    return ProposalIngestResultOut(
        opportunity_id=opp.id,
        party_id=party_resolved.id,
        party_kind="client" if isinstance(party_resolved, Client) else "lead",  # type: ignore[arg-type]
        proposal_source=proposal_source,
        payload=payload,
        confidence=100,
        requires_review=False,
        validation_errors=[],
        extraction_meta={"channel": "json_commit"},
        applied=True,
    )


@router.post("/preview", response_model=ProposalIngestPreviewOut)
def preview_proposal(
    body: ProposalAutoIngestBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_broker_or_above),
) -> ProposalIngestPreviewOut:
    """Line-neutral preview alias (Phase 9).

    Behaves identically to ``POST /auto/preview`` and is the preferred URL
    for new integrations across all insurance lines (auto, life, …).
    """
    return preview_auto_proposal(body, db, current_user)


@router.post("/commit", response_model=ProposalIngestResultOut)
def commit_proposal(
    body: ProposalAutoIngestBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_broker_or_above),
) -> ProposalIngestResultOut:
    """Line-neutral commit alias (Phase 9).

    Behaves identically to ``POST /auto/commit`` and is the preferred URL
    for new integrations across all insurance lines (auto, life, …).
    """
    return commit_auto_proposal(body, db, current_user)


@router.post("/auto/webhook")
def proposal_auto_webhook_stub() -> None:
    """Reserved for HMAC-verified partner webhooks (not enabled in MVP)."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "code": "WEBHOOK_NOT_ENABLED",
            "message": "Partner webhook ingest is not enabled yet.",
        },
    )
