from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.db.enums import InteractionType
from ai_copilot_api.db.models import Client, Interaction, Lead, Opportunity, User
from ai_copilot_api.db.session import get_db
from ai_copilot_api.domain.interaction_sync import refresh_opportunity_last_interaction_at
from ai_copilot_api.schemas.crm import InteractionCreate, InteractionOut, InteractionUpdate

router = APIRouter(prefix="/interactions", tags=["interactions"])

_MAX_PAGE = 100


def _interaction_options():
    return (selectinload(Interaction.created_by_user),)


def _interaction_or_404(db: Session, org_id: uuid.UUID, interaction_id: uuid.UUID) -> Interaction:
    row = db.scalar(
        select(Interaction)
        .options(*_interaction_options())
        .where(Interaction.id == interaction_id, Interaction.organization_id == org_id),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interaction not found")
    return row


def _validate_client_org(db: Session, org_id: uuid.UUID, client_id: uuid.UUID) -> None:
    c = db.scalar(select(Client).where(Client.id == client_id, Client.organization_id == org_id))
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")


def _validate_lead_org(db: Session, org_id: uuid.UUID, lead_id: uuid.UUID) -> None:
    row = db.scalar(select(Lead).where(Lead.id == lead_id, Lead.organization_id == org_id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")


def _validate_opportunity_for_party(
    db: Session,
    org_id: uuid.UUID,
    opportunity_id: uuid.UUID,
    client_id: uuid.UUID | None,
    lead_id: uuid.UUID | None,
) -> Opportunity:
    opp = db.scalar(
        select(Opportunity).where(
            Opportunity.id == opportunity_id,
            Opportunity.organization_id == org_id,
        ),
    )
    if opp is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    if client_id is not None:
        if opp.client_id != client_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Opportunity does not belong to this client",
            )
    elif lead_id is not None:
        if opp.lead_id != lead_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Opportunity does not belong to this lead",
            )
    return opp


@router.get("", response_model=list[InteractionOut])
def list_interactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=_MAX_PAGE),
    client_id: uuid.UUID | None = None,
    lead_id: uuid.UUID | None = None,
    opportunity_id: uuid.UUID | None = None,
    interaction_type: InteractionType | None = None,
    occurred_from: datetime | None = None,
    occurred_to: datetime | None = None,
) -> list[InteractionOut]:
    org_id = current_user.organization_id
    stmt = (
        select(Interaction)
        .options(*_interaction_options())
        .where(Interaction.organization_id == org_id)
    )
    if client_id is not None:
        stmt = stmt.where(Interaction.client_id == client_id)
    if lead_id is not None:
        stmt = stmt.where(Interaction.lead_id == lead_id)
    if opportunity_id is not None:
        stmt = stmt.where(Interaction.opportunity_id == opportunity_id)
    if interaction_type is not None:
        stmt = stmt.where(Interaction.interaction_type == interaction_type)
    if occurred_from is not None:
        stmt = stmt.where(Interaction.occurred_at >= occurred_from)
    if occurred_to is not None:
        stmt = stmt.where(Interaction.occurred_at <= occurred_to)
    stmt = stmt.order_by(Interaction.occurred_at.desc()).offset(skip).limit(limit)
    rows = db.scalars(stmt).all()
    return [InteractionOut.model_validate(r) for r in rows]


@router.post("", response_model=InteractionOut, status_code=status.HTTP_201_CREATED)
def create_interaction(
    body: InteractionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InteractionOut:
    org_id = current_user.organization_id
    if body.client_id is not None:
        _validate_client_org(db, org_id, body.client_id)
    elif body.lead_id is not None:
        _validate_lead_org(db, org_id, body.lead_id)
    opportunity_id = body.opportunity_id
    if opportunity_id is not None:
        _validate_opportunity_for_party(
            db,
            org_id,
            opportunity_id,
            body.client_id,
            body.lead_id,
        )

    occurred_at = body.occurred_at or datetime.now(UTC)
    row = Interaction(
        organization_id=org_id,
        client_id=body.client_id,
        lead_id=body.lead_id,
        opportunity_id=opportunity_id,
        created_by_id=current_user.id,
        interaction_type=body.interaction_type,
        summary=body.summary,
        occurred_at=occurred_at,
    )
    db.add(row)
    db.flush()

    if opportunity_id is not None:
        opp = db.get(Opportunity, opportunity_id)
        if opp is not None:
            if body.opportunity_next_action is not None:
                opp.next_action = body.opportunity_next_action
            if body.opportunity_next_action_due_at is not None:
                opp.next_action_due_at = body.opportunity_next_action_due_at
        refresh_opportunity_last_interaction_at(db, opportunity_id)

    db.commit()
    db.refresh(row)
    row = db.scalar(
        select(Interaction).options(*_interaction_options()).where(Interaction.id == row.id),
    )
    assert row is not None
    return InteractionOut.model_validate(row)


@router.get("/{interaction_id}", response_model=InteractionOut)
def get_interaction(
    interaction_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InteractionOut:
    row = _interaction_or_404(db, current_user.organization_id, interaction_id)
    return InteractionOut.model_validate(row)


@router.patch("/{interaction_id}", response_model=InteractionOut)
def update_interaction(
    interaction_id: uuid.UUID,
    body: InteractionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InteractionOut:
    org_id = current_user.organization_id
    row = _interaction_or_404(db, org_id, interaction_id)
    prev_opp_id = row.opportunity_id
    data = body.model_dump(exclude_unset=True)
    if "opportunity_id" in data:
        new_val = data.pop("opportunity_id")
        if new_val is not None:
            _validate_opportunity_for_party(
                db,
                org_id,
                new_val,
                row.client_id,
                row.lead_id,
            )
        row.opportunity_id = new_val

    for k, v in data.items():
        setattr(row, k, v)

    db.flush()
    refresh_opportunity_last_interaction_at(db, prev_opp_id)
    refresh_opportunity_last_interaction_at(db, row.opportunity_id)
    db.commit()
    db.refresh(row)
    row = db.scalar(
        select(Interaction)
        .options(*_interaction_options())
        .where(Interaction.id == interaction_id),
    )
    assert row is not None
    return InteractionOut.model_validate(row)


@router.delete("/{interaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_interaction(
    interaction_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    org_id = current_user.organization_id
    row = _interaction_or_404(db, org_id, interaction_id)
    opp_id = row.opportunity_id
    db.delete(row)
    db.flush()
    refresh_opportunity_last_interaction_at(db, opp_id)
    db.commit()
