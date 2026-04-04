from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.db.enums import OpportunityStage, OpportunityStatus
from ai_copilot_api.db.models import Client, Opportunity, Product, User
from ai_copilot_api.db.session import get_db
from ai_copilot_api.domain.opportunity_status import status_for_stage
from ai_copilot_api.schemas.crm import (
    OpportunityCreate,
    OpportunityOut,
    OpportunityStagePatch,
    OpportunityUpdate,
)

router = APIRouter(prefix="/opportunities", tags=["opportunities"])

_MAX_PAGE = 100


def _opp_options():
    return (
        selectinload(Opportunity.client),
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


@router.get("", response_model=list[OpportunityOut])
def list_opportunities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=_MAX_PAGE),
    stage: OpportunityStage | None = None,
    client_id: uuid.UUID | None = None,
    overdue_next_action: bool = Query(default=False),
) -> list[OpportunityOut]:
    stmt = (
        select(Opportunity)
        .options(*_opp_options())
        .where(Opportunity.organization_id == current_user.organization_id)
    )
    if stage is not None:
        stmt = stmt.where(Opportunity.stage == stage)
    if client_id is not None:
        stmt = stmt.where(Opportunity.client_id == client_id)
    if overdue_next_action:
        now = datetime.now(UTC)
        stmt = stmt.where(
            Opportunity.status == OpportunityStatus.OPEN,
            Opportunity.next_action_due_at.isnot(None),
            Opportunity.next_action_due_at < now,
        )
    stmt = stmt.order_by(Opportunity.updated_at.desc()).offset(skip).limit(limit)
    rows = db.scalars(stmt).all()
    return [OpportunityOut.model_validate(r) for r in rows]


@router.post("", response_model=OpportunityOut, status_code=status.HTTP_201_CREATED)
def create_opportunity(
    body: OpportunityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OpportunityOut:
    org_id = current_user.organization_id
    _client_in_org(db, org_id, body.client_id)
    _user_in_org(db, org_id, body.owner_id)
    _product_in_org(db, org_id, body.product_id)
    derived_status = status_for_stage(body.stage, body.status)
    row = Opportunity(
        organization_id=org_id,
        client_id=body.client_id,
        owner_id=body.owner_id,
        product_id=body.product_id,
        estimated_value=body.estimated_value,
        closing_probability=body.closing_probability,
        stage=body.stage,
        status=derived_status,
        source=body.source,
        last_interaction_at=body.last_interaction_at,
        next_action=body.next_action,
        next_action_due_at=body.next_action_due_at,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    row = db.scalar(
        select(Opportunity).options(*_opp_options()).where(Opportunity.id == row.id),
    )
    assert row is not None
    return OpportunityOut.model_validate(row)


@router.get("/{opp_id}", response_model=OpportunityOut)
def get_opportunity(
    opp_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OpportunityOut:
    row = _opportunity_or_404(db, current_user.organization_id, opp_id)
    return OpportunityOut.model_validate(row)


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
    stage_changed = False
    if "stage" in data:
        row.stage = data.pop("stage")
        stage_changed = True
        data.pop("status", None)
    for k, v in data.items():
        setattr(row, k, v)
    if stage_changed:
        row.status = status_for_stage(row.stage, row.status)
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
    row.stage = body.stage
    row.status = status_for_stage(body.stage, row.status)
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
