from __future__ import annotations

import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.db.models import (
    Client,
    Opportunity,
    Product,
    RecommendationFeedback,
    RecommendationRun,
    User,
)
from ai_copilot_api.db.session import get_db
from ai_copilot_api.domain.adequacy_batch import resolve_adequacy_for_api
from ai_copilot_api.domain.recommendation_rules import (
    IntelParty,
    evaluate_rules_for_client,
    load_client_for_intel,
    load_products_for_org,
)
from ai_copilot_api.schemas.crm import (
    ClientAdequacyOut,
    RecommendationFeedbackCreate,
    RecommendationFeedbackOut,
    RecommendationItemOut,
    RecommendationRunCreate,
    RecommendationRunOut,
    RecommendationsPreviewOut,
    RuleTraceOut,
)

router = APIRouter(prefix="/clients", tags=["intel"])


def _client_or_404(db: Session, org_id: uuid.UUID, client_id: uuid.UUID) -> Client:
    row = load_client_for_intel(db, org_id, client_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return row


def _opp_in_org(
    db: Session,
    org_id: uuid.UUID,
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
    return row


def _serialize_items(raw: list[Any]) -> list[RecommendationItemOut]:
    out: list[RecommendationItemOut] = []
    for x in raw:
        if not isinstance(x, dict):
            continue
        try:
            out.append(RecommendationItemOut.model_validate(x))
        except Exception:
            continue
    return out


def _serialize_trace(raw: list[Any]) -> list[RuleTraceOut]:
    out: list[RuleTraceOut] = []
    for x in raw:
        if not isinstance(x, dict):
            continue
        try:
            out.append(RuleTraceOut.model_validate(x))
        except Exception:
            continue
    return out


def _evaluate_to_serialized(
    party: IntelParty,
    opportunity: Opportunity | None,
    products: list[Product],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    items, trace = evaluate_rules_for_client(party, opportunity, products)
    items_payload: list[dict[str, Any]] = []
    for i in items:
        items_payload.append(
            {
                "product_id": str(i.product.id),
                "product_name": i.product.name,
                "product_category": i.product.category.value,
                "priority": i.priority,
                "rule_ids": i.rule_ids,
                "rationale": i.rationale,
                "protection_gaps": i.protection_gaps,
                "predictable_objections": i.predictable_objections,
                "next_best_action": i.next_best_action,
            },
        )
    trace_payload = [{"rule_id": t.rule_id, "fired": t.fired, "detail": t.detail} for t in trace]
    return items_payload, trace_payload


def _preview_from_client(
    db: Session,
    org_id: uuid.UUID,
    party: IntelParty,
    opportunity: Opportunity | None,
) -> RecommendationsPreviewOut:
    products = load_products_for_org(db, org_id)
    items_payload, trace_payload = _evaluate_to_serialized(party, opportunity, products)
    return RecommendationsPreviewOut(
        items=_serialize_items(items_payload),
        rule_trace=_serialize_trace(trace_payload),
    )


def _run_to_out(row: RecommendationRun) -> RecommendationRunOut:
    return RecommendationRunOut(
        id=row.id,
        organization_id=row.organization_id,
        client_id=row.client_id,
        lead_id=row.lead_id,
        opportunity_id=row.opportunity_id,
        created_by_id=row.created_by_id,
        items=_serialize_items(row.items if isinstance(row.items, list) else []),
        rule_trace=_serialize_trace(row.rule_trace if isinstance(row.rule_trace, list) else []),
        created_at=row.created_at,
    )


@router.get("/{client_id}/adequacy", response_model=ClientAdequacyOut)
def get_client_adequacy(
    client_id: uuid.UUID,
    source: Literal["batch_first", "live"] = Query(
        default="batch_first",
        description="batch_first: use last batch snapshot when present; live: always recompute",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientAdequacyOut:
    row = _client_or_404(db, current_user.organization_id, client_id)
    ad, src, computed_at, inputs_hash, rule_version = resolve_adequacy_for_api(db, row, source)
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


@router.get("/{client_id}/recommendations", response_model=RecommendationsPreviewOut)
def get_client_recommendations_preview(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    opportunity_id: uuid.UUID | None = Query(default=None),
) -> RecommendationsPreviewOut:
    """Phase 6 — evaluate rules for the client (and optional opportunity) without creating a run."""
    org_id = current_user.organization_id
    client = _client_or_404(db, org_id, client_id)
    opportunity: Opportunity | None = None
    if opportunity_id is not None:
        opportunity = _opp_in_org(db, org_id, opportunity_id)
        if opportunity.lead_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Opportunity is linked to a lead; "
                    "run recommendations on the client after conversion"
                ),
            )
        if opportunity.client_id != client_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Opportunity does not belong to this client",
            )
    return _preview_from_client(db, org_id, client, opportunity)


@router.post(
    "/{client_id}/recommendation-runs",
    response_model=RecommendationRunOut,
    status_code=status.HTTP_201_CREATED,
)
def create_recommendation_run(
    client_id: uuid.UUID,
    body: RecommendationRunCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RecommendationRunOut:
    org_id = current_user.organization_id
    client = _client_or_404(db, org_id, client_id)
    opportunity: Opportunity | None = None
    if body.opportunity_id is not None:
        opportunity = _opp_in_org(db, org_id, body.opportunity_id)
        if opportunity.lead_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Opportunity is linked to a lead; "
                    "run recommendations on the client after conversion"
                ),
            )
        if opportunity.client_id != client_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Opportunity does not belong to this client",
            )
    products = load_products_for_org(db, org_id)
    items_payload, trace_payload = _evaluate_to_serialized(client, opportunity, products)

    run = RecommendationRun(
        organization_id=org_id,
        client_id=client_id,
        opportunity_id=body.opportunity_id,
        created_by_id=current_user.id,
        items=items_payload,
        rule_trace=trace_payload,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return _run_to_out(run)


@router.get("/{client_id}/recommendation-runs", response_model=list[RecommendationRunOut])
def list_recommendation_runs(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[RecommendationRunOut]:
    _client_or_404(db, current_user.organization_id, client_id)
    stmt = (
        select(RecommendationRun)
        .where(
            RecommendationRun.organization_id == current_user.organization_id,
            RecommendationRun.client_id == client_id,
        )
        .order_by(RecommendationRun.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = db.scalars(stmt).all()
    return [_run_to_out(r) for r in rows]


@router.post(
    "/recommendation-feedback",
    response_model=RecommendationFeedbackOut,
    status_code=status.HTTP_201_CREATED,
)
def create_recommendation_feedback(
    body: RecommendationFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RecommendationFeedbackOut:
    org_id = current_user.organization_id
    _client_or_404(db, org_id, body.client_id)
    p = db.scalar(
        select(Product).where(Product.id == body.product_id, Product.organization_id == org_id),
    )
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if body.recommendation_run_id is not None:
        r = db.scalar(
            select(RecommendationRun).where(
                RecommendationRun.id == body.recommendation_run_id,
                RecommendationRun.organization_id == org_id,
                RecommendationRun.client_id == body.client_id,
            ),
        )
        if r is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recommendation run not found for this client",
            )
    row = RecommendationFeedback(
        organization_id=org_id,
        client_id=body.client_id,
        product_id=body.product_id,
        recommendation_run_id=body.recommendation_run_id,
        rule_ids=body.rule_ids,
        action=body.action,
        actor_user_id=current_user.id,
        note=body.note,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return RecommendationFeedbackOut.model_validate(row)
