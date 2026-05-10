from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import ValidationError
from sqlalchemy import func, or_, select, tuple_
from sqlalchemy.orm import Session, selectinload

from ai_copilot_api.api.deps import assert_can_extract_for_opportunity, get_current_user
from ai_copilot_api.config import Settings, get_settings
from ai_copilot_api.db.enums import (
    DocumentType,
    OpportunityStage,
    OpportunityStatus,
    ProductCategory,
)
from ai_copilot_api.db.models import (
    Client,
    CoverageTaxonomy,
    Document,
    DocumentExtractionRun,
    Lead,
    Opportunity,
    Product,
    User,
)
from ai_copilot_api.db.session import get_db
from ai_copilot_api.domain.coverage_adequacy import (
    CoverageAdequacyItem,
    assess_coverage_adequacy,
)
from ai_copilot_api.domain.document_extraction import extract_pdf_text_with_ocr
from ai_copilot_api.domain.opportunity_rules import (
    assert_next_action_when_required,
    assert_post_sale_only_after_win,
)
from ai_copilot_api.domain.opportunity_status import status_for_stage
from ai_copilot_api.domain.proposal_adapters import select_adapter_for_pdf
from ai_copilot_api.domain.proposal_ingest import (
    apply_proposal_to_opportunity,
    resolve_party,
)
from ai_copilot_api.schemas.crm import (
    CoverageAdequacyOut,
    DocumentBrief,
    DocumentExtractionRunBrief,
    OpportunityCreate,
    OpportunityDetailOut,
    OpportunityMetricsSummary,
    OpportunityOut,
    OpportunityStagePatch,
    OpportunityUpdate,
)
from ai_copilot_api.schemas.proposal_ingest import (
    ProposalIngestResultOut,
    ProposalPayload,
    select_proposal_payload_class,
)
from ai_copilot_api.storage.factory import get_object_storage

router = APIRouter(prefix="/opportunities", tags=["opportunities"])

_MAX_PAGE = 100
# Align with ``routes_document_extraction.PROPOSAL_AUTO_APPLY_MIN_CONFIDENCE`` for life PDF.
_MIN_LIFE_PDF_AUTO_APPLY_CONFIDENCE = 70


def _opp_options():
    return (
        selectinload(Opportunity.client),
        selectinload(Opportunity.lead),
        selectinload(Opportunity.owner),
        selectinload(Opportunity.product),
    )


def _opportunity_or_404(db: Session, org_id: uuid.UUID, opp_id: uuid.UUID) -> Opportunity:
    row = db.scalar(
        select(Opportunity)
        .options(*_opp_options())
        .where(Opportunity.id == opp_id, Opportunity.organization_id == org_id),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    return row


def _client_in_org(db: Session, org_id: uuid.UUID, client_id: uuid.UUID) -> None:
    c = db.scalar(select(Client).where(Client.id == client_id, Client.organization_id == org_id))
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")


def _lead_in_org(db: Session, org_id: uuid.UUID, lead_id: uuid.UUID) -> Lead:
    row = db.scalar(select(Lead).where(Lead.id == lead_id, Lead.organization_id == org_id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    if row.converted_client_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot attach opportunity to a converted lead",
        )
    return row


def _user_in_org(db: Session, org_id: uuid.UUID, user_id: uuid.UUID) -> None:
    u = db.scalar(select(User).where(User.id == user_id, User.organization_id == org_id))
    if u is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Owner user not found")


def _product_in_org(db: Session, org_id: uuid.UUID, product_id: uuid.UUID | None) -> None:
    if product_id is None:
        return
    p = db.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.organization_id == org_id,
        ),
    )
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")


def _assert_product_line_match(
    db: Session,
    org_id: uuid.UUID,
    product_id: uuid.UUID | None,
    insurance_line: ProductCategory | None,
) -> None:
    """Enforce ADR D1: when product_id is set, product.category must match insurance_line."""
    if product_id is None or insurance_line is None:
        return
    p = db.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.organization_id == org_id,
        ),
    )
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if p.category != insurance_line:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"insurance_line ({insurance_line.value}) does not match "
                f"product.category ({p.category.value})"
            ),
        )


def _assert_quote_consistency_on_row(row: Opportunity) -> None:
    """Mirror the DB CHECK constraint at the API layer for clearer 422 errors."""
    if row.quote_number is None:
        if row.proposal_source is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="quote_number is required when proposal_source is set",
            )
        return
    if not (row.preferred_insurer_name and row.preferred_insurer_name.strip()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="preferred_insurer_name is required when quote_number is set",
        )
    if row.quote_item is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="quote_item is required when quote_number is set",
        )
    if row.proposal_source is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="proposal_source is required when quote_number is set",
        )


@router.get("/metrics/summary", response_model=OpportunityMetricsSummary)
def opportunity_metrics_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OpportunityMetricsSummary:
    org_id = current_user.organization_id
    stage_rows = db.execute(
        select(Opportunity.stage, func.count())
        .where(Opportunity.organization_id == org_id)
        .group_by(Opportunity.stage),
    ).all()
    owner_rows = db.execute(
        select(Opportunity.owner_id, func.count())
        .where(
            Opportunity.organization_id == org_id,
            Opportunity.status == OpportunityStatus.OPEN,
        )
        .group_by(Opportunity.owner_id),
    ).all()
    open_total = db.scalar(
        select(func.count())
        .select_from(Opportunity)
        .where(
            Opportunity.organization_id == org_id,
            Opportunity.status == OpportunityStatus.OPEN,
        ),
    )
    return OpportunityMetricsSummary(
        by_stage={str(r[0].value): int(r[1]) for r in stage_rows},
        by_owner_open={str(r[0]): int(r[1]) for r in owner_rows},
        open_total=int(open_total or 0),
    )


@router.get("", response_model=list[OpportunityOut])
def list_opportunities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=_MAX_PAGE),
    stage: OpportunityStage | None = None,
    status: OpportunityStatus | None = None,
    client_id: uuid.UUID | None = None,
    lead_id: uuid.UUID | None = None,
    owner_id: uuid.UUID | None = None,
    insurance_line: ProductCategory | None = None,
    overdue_next_action: bool = Query(default=False),
    q: str | None = Query(default=None, max_length=200),
    sort: str = Query(
        default="updated_at_desc",
        description="updated_at_desc | propensity_desc (prob. × valor estimado)",
    ),
) -> list[OpportunityOut]:
    stmt = (
        select(Opportunity)
        .options(*_opp_options())
        .outerjoin(Client, Client.id == Opportunity.client_id)
        .outerjoin(Lead, Lead.id == Opportunity.lead_id)
        .where(Opportunity.organization_id == current_user.organization_id)
    )
    if q and q.strip():
        pat = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Client.full_name.ilike(pat),
                Lead.full_name.ilike(pat),
            ),
        )
    if stage is not None:
        stmt = stmt.where(Opportunity.stage == stage)
    if status is not None:
        stmt = stmt.where(Opportunity.status == status)
    if client_id is not None:
        stmt = stmt.where(Opportunity.client_id == client_id)
    if lead_id is not None:
        stmt = stmt.where(Opportunity.lead_id == lead_id)
    if owner_id is not None:
        stmt = stmt.where(Opportunity.owner_id == owner_id)
    if insurance_line is not None:
        stmt = stmt.where(Opportunity.insurance_line == insurance_line)
    if overdue_next_action:
        now = datetime.now(UTC)
        stmt = stmt.where(
            Opportunity.status == OpportunityStatus.OPEN,
            Opportunity.next_action_due_at.isnot(None),
            Opportunity.next_action_due_at < now,
        )
    if sort == "propensity_desc":
        propensity = Opportunity.closing_probability * func.coalesce(Opportunity.estimated_value, 0)
        stmt = stmt.order_by(propensity.desc(), Opportunity.updated_at.desc())
    elif sort == "updated_at_desc":
        stmt = stmt.order_by(Opportunity.updated_at.desc())
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="sort must be updated_at_desc or propensity_desc",
        )
    stmt = stmt.offset(skip).limit(limit)
    rows = db.scalars(stmt).all()
    return [OpportunityOut.model_validate(r) for r in rows]


@router.post("", response_model=OpportunityOut, status_code=status.HTTP_201_CREATED)
def create_opportunity(
    body: OpportunityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OpportunityOut:
    org_id = current_user.organization_id
    cid: uuid.UUID | None = None
    lid: uuid.UUID | None = None
    if body.client_id is not None:
        _client_in_org(db, org_id, body.client_id)
        cid = body.client_id
    elif body.lead_id is not None:
        _lead_in_org(db, org_id, body.lead_id)
        lid = body.lead_id
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Exactly one of client_id or lead_id is required",
        )
    _user_in_org(db, org_id, body.owner_id)
    _assert_product_line_match(db, org_id, body.product_id, body.insurance_line)
    derived_status = status_for_stage(body.stage, body.status)
    row = Opportunity(
        organization_id=org_id,
        client_id=cid,
        lead_id=lid,
        owner_id=body.owner_id,
        product_id=body.product_id,
        insurance_line=body.insurance_line,
        estimated_value=body.estimated_value,
        closing_probability=body.closing_probability,
        stage=body.stage,
        status=derived_status,
        source=body.source,
        last_interaction_at=body.last_interaction_at,
        next_action=body.next_action,
        next_action_due_at=body.next_action_due_at,
        preferred_insurer_name=body.preferred_insurer_name,
        expected_close_at=body.expected_close_at,
        loss_reason=body.loss_reason.strip()
        if body.stage == OpportunityStage.CLOSED_LOST and body.loss_reason
        else None,
        proposal_source=body.proposal_source,
        quote_number=body.quote_number,
        quote_item=body.quote_item,
        quote_valid_until=body.quote_valid_until,
        proposal_data=body.proposal_data,
    )
    assert_next_action_when_required(row)
    _assert_quote_consistency_on_row(row)
    db.add(row)
    db.commit()
    db.refresh(row)
    row = db.scalar(
        select(Opportunity).options(*_opp_options()).where(Opportunity.id == row.id),
    )
    assert row is not None
    return OpportunityOut.model_validate(row)


@router.get("/{opp_id}", response_model=OpportunityDetailOut)
def get_opportunity(
    opp_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OpportunityDetailOut:
    """Fetch an opportunity with documents and per-coverage adequacy.

    Phase 6 — embeds `DocumentBrief` rows so the UI can render the documents
    tab and the extraction status of each PDF in a single round-trip.
    Phase 9 — adds `coverage_adequacy[]` (per-code traffic light) when the
    opportunity has both a linked product and a non-empty `proposal_data`.
    """
    org_id = current_user.organization_id
    row = _opportunity_or_404(db, org_id, opp_id)
    docs = _opportunity_documents_brief(db, org_id, opp_id)
    coverage_items = _opportunity_coverage_adequacy(db, org_id, row)
    base = OpportunityOut.model_validate(row).model_dump()
    return OpportunityDetailOut(
        **base,
        documents=docs,
        coverage_adequacy=[CoverageAdequacyOut.model_validate(c) for c in coverage_items],
    )


def _opportunity_coverage_adequacy(
    db: Session,
    org_id: uuid.UUID,
    opp: Opportunity,
) -> list[CoverageAdequacyItem]:
    """Compute per-coverage traffic light for an opportunity (Phase 9).

    Returns an empty list when there is no expected coverage set to compare
    against — the route then surfaces an empty `coverage_adequacy[]` and the
    UI can fall back to the global adequacy semáforo.
    """
    if not isinstance(opp.proposal_data, dict) or not opp.proposal_data:
        return []
    if opp.product_id is None:
        return []
    product = db.scalar(
        select(Product).where(
            Product.id == opp.product_id,
            Product.organization_id == org_id,
        ),
    )
    if product is None:
        return []
    taxonomy_rows = db.scalars(
        select(CoverageTaxonomy).where(
            CoverageTaxonomy.organization_id == org_id,
            CoverageTaxonomy.active.is_(True),
        ),
    ).all()
    taxonomy = [
        {"code": r.code, "label": r.label, "synonyms": r.synonyms or []}
        for r in taxonomy_rows
    ]
    return assess_coverage_adequacy(
        opportunity=opp,
        product=product,
        taxonomy=taxonomy,
    )


def _opportunity_documents_brief(
    db: Session,
    org_id: uuid.UUID,
    opp_id: uuid.UUID,
) -> list[DocumentBrief]:
    """Return `DocumentBrief` rows for `opp_id` with the latest extraction summary."""
    docs = db.scalars(
        select(Document)
        .where(
            Document.organization_id == org_id,
            Document.opportunity_id == opp_id,
        )
        .order_by(Document.updated_at.desc()),
    ).all()
    if not docs:
        return []
    doc_ids = [d.id for d in docs]
    latest_per_doc_subq = (
        select(
            DocumentExtractionRun.document_id,
            func.max(DocumentExtractionRun.created_at).label("created_at"),
        )
        .where(
            DocumentExtractionRun.organization_id == org_id,
            DocumentExtractionRun.document_id.in_(doc_ids),
        )
        .group_by(DocumentExtractionRun.document_id)
        .subquery()
    )
    runs = db.scalars(
        select(DocumentExtractionRun).join(
            latest_per_doc_subq,
            tuple_(
                DocumentExtractionRun.document_id,
                DocumentExtractionRun.created_at,
            )
            == tuple_(
                latest_per_doc_subq.c.document_id,
                latest_per_doc_subq.c.created_at,
            ),
        ),
    ).all()
    latest_run_by_doc = {r.document_id: r for r in runs}
    out: list[DocumentBrief] = []
    for d in docs:
        run = latest_run_by_doc.get(d.id)
        out.append(
            DocumentBrief(
                id=d.id,
                document_type=d.document_type,
                original_filename=d.original_filename,
                content_type=d.content_type,
                size_bytes=d.size_bytes,
                current_version=d.current_version,
                created_at=d.created_at,
                updated_at=d.updated_at,
                latest_extraction_run=DocumentExtractionRunBrief.model_validate(run)
                if run is not None
                else None,
            ),
        )
    return out


@router.patch("/{opp_id}", response_model=OpportunityOut)
def update_opportunity(
    opp_id: uuid.UUID,
    body: OpportunityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OpportunityOut:
    org_id = current_user.organization_id
    row = _opportunity_or_404(db, org_id, opp_id)
    data = body.model_dump(exclude_unset=True)
    if "owner_id" in data:
        _user_in_org(db, org_id, data["owner_id"])
    if "product_id" in data:
        _product_in_org(db, org_id, data["product_id"])

    prior_stage = row.stage
    target_stage = data.pop("stage", None)
    loss_reason_in = data.pop("loss_reason", None)
    data.pop("status", None)

    for k, v in data.items():
        setattr(row, k, v)

    _assert_product_line_match(db, org_id, row.product_id, row.insurance_line)
    _assert_quote_consistency_on_row(row)

    if target_stage is not None:
        if target_stage == OpportunityStage.POST_SALE:
            assert_post_sale_only_after_win(prior_stage, row.status)
        if target_stage == OpportunityStage.CLOSED_LOST:
            if loss_reason_in is not None and str(loss_reason_in).strip():
                row.loss_reason = str(loss_reason_in).strip()
            elif prior_stage != OpportunityStage.CLOSED_LOST:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="loss_reason is required when closing as lost",
                )
        elif prior_stage == OpportunityStage.CLOSED_LOST:
            row.loss_reason = None
        row.stage = target_stage
        row.status = status_for_stage(target_stage, row.status)
    elif loss_reason_in is not None and row.stage == OpportunityStage.CLOSED_LOST:
        row.loss_reason = str(loss_reason_in).strip()

    assert_next_action_when_required(row)
    db.commit()
    db.refresh(row)
    row = db.scalar(
        select(Opportunity).options(*_opp_options()).where(Opportunity.id == opp_id),
    )
    assert row is not None
    return OpportunityOut.model_validate(row)


@router.post("/{opp_id}/stage", response_model=OpportunityOut)
def transition_opportunity_stage(
    opp_id: uuid.UUID,
    body: OpportunityStagePatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OpportunityOut:
    org_id = current_user.organization_id
    row = _opportunity_or_404(db, org_id, opp_id)
    prior_stage = row.stage
    prior_status = row.status
    if body.stage == OpportunityStage.POST_SALE:
        assert_post_sale_only_after_win(prior_stage, prior_status)
    if body.stage == OpportunityStage.CLOSED_LOST:
        row.loss_reason = body.loss_reason.strip() if body.loss_reason else None
    elif prior_stage == OpportunityStage.CLOSED_LOST:
        row.loss_reason = None
    row.stage = body.stage
    row.status = status_for_stage(body.stage, row.status)
    assert_next_action_when_required(row)
    db.commit()
    db.refresh(row)
    row = db.scalar(
        select(Opportunity).options(*_opp_options()).where(Opportunity.id == opp_id),
    )
    assert row is not None
    return OpportunityOut.model_validate(row)


@router.delete("/{opp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_opportunity(
    opp_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    row = db.scalar(
        select(Opportunity).where(
            Opportunity.id == opp_id,
            Opportunity.organization_id == current_user.organization_id,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    db.delete(row)
    db.commit()


def _latest_proposal_document(
    db: Session,
    org_id: uuid.UUID,
    opportunity_id: uuid.UUID,
) -> Document:
    doc = db.scalar(
        select(Document)
        .where(
            Document.organization_id == org_id,
            Document.opportunity_id == opportunity_id,
            Document.document_type == DocumentType.PROPOSAL,
        )
        .order_by(Document.updated_at.desc())
        .limit(1),
    )
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No PROPOSAL document linked to this opportunity",
        )
    return doc


def _validation_errors_payload(exc: ValidationError) -> list[dict[str, Any]]:
    """Reduce Pydantic errors to a UI-friendly list."""
    return [
        {
            "loc": list(err.get("loc", ())),
            "msg": err.get("msg"),
            "type": err.get("type"),
        }
        for err in exc.errors()
    ]


def _resolve_party_or_422(
    db: Session,
    organization_id: uuid.UUID,
    payload: ProposalPayload,
    opportunity: Opportunity,
) -> Client | Lead:
    """Resolve the proposal applicant to a Client/Lead or raise 422 (ADR §D7)."""
    try:
        return resolve_party(
            db,
            organization_id,
            payload.applicant,
            opportunity=opportunity,
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.post("/{opp_id}/proposal-extract", response_model=ProposalIngestResultOut)
def proposal_extract(
    opp_id: uuid.UUID,
    dry_run: bool = Query(default=False),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_user),
) -> ProposalIngestResultOut:
    """Run PDF extraction for an `Opportunity`'s latest PROPOSAL document.

    Dispatches on ``insurance_line`` to the PDF adapter (Bradesco auto,
    Tokio PME vida, …), validates against the matching canonical payload
    class, then persists ``proposal_data`` when the run is trusted enough
    to auto-apply (life PDFs require min confidence / no extraction review).
    """
    org_id = current_user.organization_id
    row = _opportunity_or_404(db, org_id, opp_id)
    assert_can_extract_for_opportunity(current_user, row)

    doc = _latest_proposal_document(db, org_id, opp_id)
    storage = get_object_storage(settings)
    pdf_bytes = storage.get_object(doc.storage_key)
    raw_text, extraction_meta = extract_pdf_text_with_ocr(
        pdf_bytes,
        ocr_enabled=settings.ocr_enabled,
        min_text_chars=settings.ocr_min_text_chars,
        language=settings.ocr_language,
        provider_url=settings.ocr_provider_url,
        provider_timeout_seconds=settings.ocr_provider_timeout_seconds,
        provider_max_pages=settings.ocr_provider_max_pages,
        provider_dpi=settings.ocr_provider_dpi,
    )
    compact_text = " ".join(raw_text.split())

    try:
        adapter = select_adapter_for_pdf(row.insurance_line)
    except NotImplementedError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    canonical_dict = adapter.to_canonical_dict(
        {"compact_text": compact_text, "raw_text": raw_text},
    )

    payload_cls = select_proposal_payload_class(row.insurance_line)
    payload: ProposalPayload | None = None
    validation_errors: list[dict[str, Any]] = []
    confidence = 0
    requires_review = True
    try:
        payload = payload_cls.model_validate(canonical_dict)
    except ValidationError as exc:
        validation_errors = _validation_errors_payload(exc)

    life_ext = getattr(adapter, "last_pdf_extraction", None)
    if life_ext is not None:
        confidence = life_ext.confidence
        low_conf = confidence < _MIN_LIFE_PDF_AUTO_APPLY_CONFIDENCE
        requires_review = payload is None or life_ext.requires_review or low_conf
    elif payload is not None:
        confidence = 80
        requires_review = False
    else:
        confidence = 0
        requires_review = True

    extraction_run = DocumentExtractionRun(
        organization_id=org_id,
        document_id=doc.id,
        created_by_id=current_user.id,
        confidence=confidence,
        requires_review=requires_review,
        extracted_data={
            "insurance_line": row.insurance_line.value,
            "canonical_dict": canonical_dict,
            "extraction_meta": extraction_meta,
            "validation_errors": validation_errors,
            "proposal_source": adapter.source,
        },
        normalized_data={"payload": payload.model_dump(mode="json") if payload else None},
    )

    party_id: uuid.UUID | None = None
    party_kind: str | None = None
    applied = False
    if payload is not None:
        party = _resolve_party_or_422(db, org_id, payload, row)
        party_id = party.id
        party_kind = "client" if isinstance(party, Client) else "lead"
        should_apply = True
        if life_ext is not None:
            should_apply = (
                not life_ext.requires_review and confidence >= _MIN_LIFE_PDF_AUTO_APPLY_CONFIDENCE
            )
        if not dry_run and should_apply:
            apply_proposal_to_opportunity(
                db,
                opportunity=row,
                payload=payload,
                proposal_source=adapter.source,
                actor_user_id=current_user.id,
                party=party,
            )
            _assert_quote_consistency_on_row(row)
            applied = True

    if not dry_run:
        db.add(extraction_run)
        db.commit()
        db.refresh(extraction_run)
        run_id = extraction_run.id
    else:
        run_id = None

    return ProposalIngestResultOut(
        opportunity_id=opp_id,
        party_id=party_id,
        party_kind=party_kind,  # type: ignore[arg-type]
        document_id=doc.id,
        extraction_run_id=run_id,
        proposal_source=adapter.source,
        payload=payload,
        confidence=confidence,
        requires_review=requires_review,
        validation_errors=validation_errors,
        extraction_meta=extraction_meta,
        applied=applied,
    )
