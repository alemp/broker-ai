from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.api.routes_intel import (
    _evaluate_to_serialized,
    _run_to_out,
    _serialize_items,
    _serialize_trace,
)
from ai_copilot_api.db.models import Lead, Opportunity, RecommendationRun, User
from ai_copilot_api.db.session import get_db
from ai_copilot_api.domain.adequacy_batch import resolve_adequacy_for_lead_api
from ai_copilot_api.domain.recommendation_rules import load_lead_for_intel, load_products_for_org
from ai_copilot_api.schemas.crm import (
    ClientAdequacyOut,
    RecommendationRunCreate,
    RecommendationRunOut,
    RecommendationsPreviewOut,
)

router = APIRouter(prefix="/leads", tags=["intel-leads"])


def _lead_or_404(db: Session, org_id: uuid.UUID, lead_id: uuid.UUID) -> Lead:
    row = load_lead_for_intel(db, org_id, lead_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return row


def _opp_for_lead(
    db: Session,
    org_id: uuid.UUID,
    lead_id: uuid.UUID,
    opp_id: uuid.UUID,
) -> Opportunity:
    row = db.scalar(
        select(Opportunity).where(
            Opportunity.id == opp_id,
            Opportunity.organization_id == org_id,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    if row.lead_id != lead_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Opportunity does not belong to this lead",
        )
    return row


def _preview_from_lead(
    db: Session,
    org_id: uuid.UUID,
    lead: Lead,
    opportunity: Opportunity | None,
) -> RecommendationsPreviewOut:
    products = load_products_for_org(db, org_id)
    items_payload, trace_payload = _evaluate_to_serialized(lead, opportunity, products)
    return RecommendationsPreviewOut(
        items=_serialize_items(items_payload),
        rule_trace=_serialize_trace(trace_payload),
    )


@router.get("/{lead_id}/adequacy", response_model=ClientAdequacyOut)
def get_lead_adequacy(
    lead_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientAdequacyOut:
    row = _lead_or_404(db, current_user.organization_id, lead_id)
    ad, src, computed_at, inputs_hash, rule_version = resolve_adequacy_for_lead_api(row)
    return ClientAdequacyOut(
        traffic_light=ad.traffic_light,
        summary=ad.summary,
        reasons=ad.reasons,
        needs_human_review=ad.needs_human_review,
        profile_completeness_score=ad.profile_completeness_score,
        profile_alert_codes=ad.profile_alert_codes,
        source=src,
        computed_at=computed_at,
        inputs_hash=inputs_hash,
        rule_version=rule_version,
    )


@router.get("/{lead_id}/recommendations", response_model=RecommendationsPreviewOut)
def get_lead_recommendations_preview(
    lead_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    opportunity_id: uuid.UUID | None = Query(default=None),
) -> RecommendationsPreviewOut:
    org_id = current_user.organization_id
    lead = _lead_or_404(db, org_id, lead_id)
    opportunity: Opportunity | None = None
    if opportunity_id is not None:
        opportunity = _opp_for_lead(db, org_id, lead_id, opportunity_id)
    return _preview_from_lead(db, org_id, lead, opportunity)


@router.post(
    "/{lead_id}/recommendation-runs",
    response_model=RecommendationRunOut,
    status_code=status.HTTP_201_CREATED,
)
def create_lead_recommendation_run(
    lead_id: uuid.UUID,
    body: RecommendationRunCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RecommendationRunOut:
    org_id = current_user.organization_id
    lead = _lead_or_404(db, org_id, lead_id)
    opportunity: Opportunity | None = None
    if body.opportunity_id is not None:
        opportunity = _opp_for_lead(db, org_id, lead_id, body.opportunity_id)
    products = load_products_for_org(db, org_id)
    items_payload, trace_payload = _evaluate_to_serialized(lead, opportunity, products)

    run = RecommendationRun(
        organization_id=org_id,
        client_id=None,
        lead_id=lead_id,
        opportunity_id=body.opportunity_id,
        created_by_id=current_user.id,
        items=items_payload,
        rule_trace=trace_payload,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return _run_to_out(run)


@router.get("/{lead_id}/recommendation-runs", response_model=list[RecommendationRunOut])
def list_lead_recommendation_runs(
    lead_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[RecommendationRunOut]:
    _lead_or_404(db, current_user.organization_id, lead_id)
    stmt = (
        select(RecommendationRun)
        .where(
            RecommendationRun.organization_id == current_user.organization_id,
            RecommendationRun.lead_id == lead_id,
        )
        .order_by(RecommendationRun.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = db.scalars(stmt).all()
    return [_run_to_out(r) for r in rows]
