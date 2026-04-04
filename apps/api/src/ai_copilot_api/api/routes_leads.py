from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.db.enums import (
    ClientKind,
    CrmAuditAction,
    CrmEntityType,
    LeadStatus,
    OpportunityStage,
)
from ai_copilot_api.db.models import Client, Lead, Opportunity, Product, User
from ai_copilot_api.db.session import get_db
from ai_copilot_api.domain.crm_audit import (
    record_audit,
    record_entity_snapshot_create,
    record_field_updates,
)
from ai_copilot_api.domain.opportunity_rules import assert_next_action_when_required
from ai_copilot_api.domain.opportunity_status import status_for_stage
from ai_copilot_api.schemas.crm import (
    ClientOut,
    LeadConvertRequest,
    LeadConvertResponse,
    LeadCreate,
    LeadOut,
    LeadUpdate,
    OpportunityOut,
)

router = APIRouter(prefix="/leads", tags=["leads"])

_MAX_PAGE = 100


def _lead_options():
    return (selectinload(Lead.owner_user),)


def _user_in_org(db: Session, org_id: uuid.UUID, user_id: uuid.UUID) -> None:
    u = db.scalar(select(User).where(User.id == user_id, User.organization_id == org_id))
    if u is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")


def _product_in_org(db: Session, org_id: uuid.UUID, product_id: uuid.UUID | None) -> None:
    if product_id is None:
        return
    p = db.scalar(
        select(Product).where(Product.id == product_id, Product.organization_id == org_id),
    )
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")


def _lead_or_404(db: Session, org_id: uuid.UUID, lead_id: uuid.UUID) -> Lead:
    row = db.scalar(
        select(Lead)
        .options(*_lead_options())
        .where(Lead.id == lead_id, Lead.organization_id == org_id),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return row


def _client_snapshot_for_audit(row: Client) -> dict:
    return {
        "full_name": row.full_name,
        "email": row.email,
        "phone": row.phone,
        "external_id": row.external_id,
        "notes": row.notes,
        "owner_id": row.owner_id,
        "client_kind": row.client_kind.value if row.client_kind else None,
        "company_legal_name": row.company_legal_name,
        "company_tax_id": row.company_tax_id,
    }


@router.get("", response_model=list[LeadOut])
def list_leads(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=_MAX_PAGE),
    status_filter: LeadStatus | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None, max_length=200),
) -> list[LeadOut]:
    stmt = (
        select(Lead)
        .options(*_lead_options())
        .where(Lead.organization_id == current_user.organization_id)
    )
    if status_filter is not None:
        stmt = stmt.where(Lead.status == status_filter)
    if q and q.strip():
        pat = f"%{q.strip()}%"
        stmt = stmt.where(or_(Lead.full_name.ilike(pat), Lead.email.ilike(pat)))
    stmt = stmt.order_by(Lead.updated_at.desc()).offset(skip).limit(limit)
    rows = db.scalars(stmt).all()
    return [LeadOut.model_validate(r) for r in rows]


@router.post("", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
def create_lead(
    body: LeadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LeadOut:
    org_id = current_user.organization_id
    if body.owner_id is not None:
        _user_in_org(db, org_id, body.owner_id)
    row = Lead(
        organization_id=org_id,
        full_name=body.full_name,
        email=str(body.email) if body.email is not None else None,
        phone=body.phone,
        source=body.source,
        notes=body.notes,
        owner_id=body.owner_id,
        status=body.status,
    )
    db.add(row)
    db.flush()
    record_entity_snapshot_create(
        db,
        organization_id=org_id,
        actor_user_id=current_user.id,
        entity_type=CrmEntityType.LEAD,
        entity_id=row.id,
        snapshot={
            "full_name": row.full_name,
            "email": row.email,
            "phone": row.phone,
            "source": row.source,
            "notes": row.notes,
            "owner_id": row.owner_id,
            "status": row.status.value,
        },
    )
    db.commit()
    row = db.scalar(
        select(Lead).options(*_lead_options()).where(Lead.id == row.id),
    )
    assert row is not None
    return LeadOut.model_validate(row)


@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(
    lead_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LeadOut:
    row = _lead_or_404(db, current_user.organization_id, lead_id)
    return LeadOut.model_validate(row)


@router.patch("/{lead_id}", response_model=LeadOut)
def update_lead(
    lead_id: uuid.UUID,
    body: LeadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LeadOut:
    org_id = current_user.organization_id
    row = _lead_or_404(db, org_id, lead_id)
    if row.converted_client_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot update a converted lead",
        )
    before = {
        "full_name": row.full_name,
        "email": row.email,
        "phone": row.phone,
        "source": row.source,
        "notes": row.notes,
        "owner_id": row.owner_id,
        "status": row.status.value,
    }
    data = body.model_dump(exclude_unset=True)
    if "email" in data and data["email"] is not None:
        data["email"] = str(data["email"])
    if "owner_id" in data and data["owner_id"] is not None:
        _user_in_org(db, org_id, data["owner_id"])
    for k, v in data.items():
        setattr(row, k, v)
    db.flush()
    after = {
        "full_name": row.full_name,
        "email": row.email,
        "phone": row.phone,
        "source": row.source,
        "notes": row.notes,
        "owner_id": row.owner_id,
        "status": row.status.value,
    }
    updates = {k: after[k] for k in before if before[k] != after[k]}
    if updates:
        record_field_updates(
            db,
            organization_id=org_id,
            actor_user_id=current_user.id,
            entity_type=CrmEntityType.LEAD,
            entity_id=lead_id,
            before=before,
            updates=updates,
        )
    db.commit()
    row = db.scalar(
        select(Lead).options(*_lead_options()).where(Lead.id == lead_id),
    )
    assert row is not None
    return LeadOut.model_validate(row)


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(
    lead_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    org_id = current_user.organization_id
    row = _lead_or_404(db, org_id, lead_id)
    if row.converted_client_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a converted lead",
        )
    record_audit(
        db,
        organization_id=org_id,
        actor_user_id=current_user.id,
        entity_type=CrmEntityType.LEAD,
        entity_id=lead_id,
        action=CrmAuditAction.DELETE,
    )
    db.delete(row)
    db.commit()


@router.post("/{lead_id}/convert", response_model=LeadConvertResponse)
def convert_lead(
    lead_id: uuid.UUID,
    body: LeadConvertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LeadConvertResponse:
    org_id = current_user.organization_id
    row = _lead_or_404(db, org_id, lead_id)
    if row.converted_client_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Lead already converted",
        )

    client_owner = body.client_owner_id if body.client_owner_id is not None else row.owner_id
    if client_owner is not None:
        _user_in_org(db, org_id, client_owner)

    client_row = Client(
        organization_id=org_id,
        full_name=row.full_name,
        email=row.email,
        phone=row.phone,
        notes=row.notes,
        owner_id=client_owner,
        client_kind=ClientKind.INDIVIDUAL,
    )
    db.add(client_row)
    db.flush()

    record_entity_snapshot_create(
        db,
        organization_id=org_id,
        actor_user_id=current_user.id,
        entity_type=CrmEntityType.CLIENT,
        entity_id=client_row.id,
        snapshot=_client_snapshot_for_audit(client_row),
    )

    opp_out: OpportunityOut | None = None
    new_opp_id: uuid.UUID | None = None
    if body.opportunity is not None:
        op = body.opportunity
        _user_in_org(db, org_id, op.owner_id)
        _product_in_org(db, org_id, op.product_id)
        derived_status = status_for_stage(op.stage, op.status)
        opp_row = Opportunity(
            organization_id=org_id,
            client_id=client_row.id,
            owner_id=op.owner_id,
            product_id=op.product_id,
            estimated_value=op.estimated_value,
            closing_probability=op.closing_probability,
            stage=op.stage,
            status=derived_status,
            source=op.source,
            last_interaction_at=op.last_interaction_at,
            next_action=op.next_action,
            next_action_due_at=op.next_action_due_at,
            preferred_insurer_name=op.preferred_insurer_name,
            expected_close_at=op.expected_close_at,
            loss_reason=op.loss_reason.strip()
            if op.stage == OpportunityStage.CLOSED_LOST and op.loss_reason
            else None,
        )
        db.add(opp_row)
        db.flush()
        assert_next_action_when_required(opp_row)
        new_opp_id = opp_row.id
        record_audit(
            db,
            organization_id=org_id,
            actor_user_id=current_user.id,
            entity_type=CrmEntityType.OPPORTUNITY,
            entity_id=opp_row.id,
            action=CrmAuditAction.CREATE,
            field_name="client_id",
            old_value=None,
            new_value=str(client_row.id),
        )

    row.converted_client_id = client_row.id
    row.status = LeadStatus.CONVERTED
    record_audit(
        db,
        organization_id=org_id,
        actor_user_id=current_user.id,
        entity_type=CrmEntityType.LEAD,
        entity_id=lead_id,
        action=CrmAuditAction.CONVERT,
        field_name="converted_client_id",
        old_value=None,
        new_value=str(client_row.id),
    )

    db.commit()
    db.refresh(client_row)
    client_row = db.scalar(
        select(Client).options(selectinload(Client.owner)).where(Client.id == client_row.id),
    )
    assert client_row is not None
    client_out = ClientOut.model_validate(client_row)

    if new_opp_id is not None:
        opp_row = db.scalar(
            select(Opportunity)
            .options(
                selectinload(Opportunity.client),
                selectinload(Opportunity.owner),
                selectinload(Opportunity.product),
            )
            .where(Opportunity.id == new_opp_id),
        )
        if opp_row is not None:
            opp_out = OpportunityOut.model_validate(opp_row)

    return LeadConvertResponse(client=client_out, opportunity=opp_out)
