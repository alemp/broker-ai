from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import ValidationError
from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session, joinedload, selectinload

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.api.routes_clients import (
    _INSURED_AUDIT_KEYS,
    _build_client_detail_out,
    _insured_audit_dict,
)
from ai_copilot_api.db.enums import (
    ClientKind,
    CrmAuditAction,
    CrmEntityType,
    LeadStatus,
    OpportunityStage,
)
from ai_copilot_api.db.models import (
    Client,
    ClientHeldProduct,
    InsuredPerson,
    Interaction,
    Lead,
    Opportunity,
    Product,
    User,
)
from ai_copilot_api.db.session import get_db
from ai_copilot_api.domain.client_profile import (
    coerce_profile_dict,
    merge_profile_dict,
    profile_bundle_from_raw,
)
from ai_copilot_api.domain.crm_audit import (
    record_audit,
    record_entity_snapshot_create,
    record_field_updates,
)
from ai_copilot_api.domain.opportunity_rules import assert_next_action_when_required
from ai_copilot_api.domain.opportunity_status import status_for_stage
from ai_copilot_api.schemas.client_profile import ClientInsuranceProfile, ClientProfileOut
from ai_copilot_api.schemas.crm import (
    ClientHeldProductCreate,
    ClientHeldProductOut,
    ClientHeldProductUpdate,
    InsuredPersonCreate,
    InsuredPersonOut,
    InsuredPersonUpdate,
    LeadConvertRequest,
    LeadConvertResponse,
    LeadCreate,
    LeadDetailOut,
    LeadOut,
    LeadUpdate,
    OpportunityOut,
)

router = APIRouter(prefix="/leads", tags=["leads"])

_MAX_PAGE = 100


def _lead_options():
    return (selectinload(Lead.owner_user),)


def _lead_detail_options():
    return (
        selectinload(Lead.owner_user),
        selectinload(Lead.insured_persons),
        selectinload(Lead.held_products).selectinload(ClientHeldProduct.product),
    )


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


def _lead_or_404_detail(db: Session, org_id: uuid.UUID, lead_id: uuid.UUID) -> Lead:
    row = db.scalar(
        select(Lead)
        .options(*_lead_detail_options())
        .where(Lead.id == lead_id, Lead.organization_id == org_id),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return row


def _build_lead_detail_out(row: Lead) -> LeadDetailOut:
    base = LeadOut.model_validate(row)
    insured = getattr(row, "insured_persons", []) or []
    held = getattr(row, "held_products", []) or []
    prof, score, alerts = profile_bundle_from_raw(row.profile_data)
    return LeadDetailOut(
        **base.model_dump(),
        insured_persons=[InsuredPersonOut.model_validate(p) for p in insured],
        held_products=[ClientHeldProductOut.model_validate(h) for h in held],
        profile=prof,
        profile_completeness_score=score,
        profile_alerts=alerts,
    )


def _assert_lead_mutable(row: Lead) -> None:
    if row.converted_client_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot modify portfolio on a converted lead",
        )


def _client_snapshot_for_audit(row: Client) -> dict:
    return {
        "full_name": row.full_name,
        "email": row.email,
        "phone": row.phone,
        "date_of_birth": row.date_of_birth,
        "external_id": row.external_id,
        "source": row.source,
        "notes": row.notes,
        "owner_id": row.owner_id,
        "client_kind": row.client_kind.value if row.client_kind else None,
        "company_legal_name": row.company_legal_name,
        "company_tax_id": row.company_tax_id,
        "marketing_opt_in": row.marketing_opt_in,
        "preferred_marketing_channel": row.preferred_marketing_channel,
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
        date_of_birth=body.date_of_birth,
        external_id=body.external_id,
        source=body.source,
        notes=body.notes,
        owner_id=body.owner_id,
        status=body.status,
        client_kind=body.client_kind,
        company_legal_name=body.company_legal_name,
        company_tax_id=body.company_tax_id,
        marketing_opt_in=body.marketing_opt_in,
        preferred_marketing_channel=body.preferred_marketing_channel,
        profile_data=dict(body.profile_data) if body.profile_data else {},
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
            "date_of_birth": row.date_of_birth,
            "external_id": row.external_id,
            "source": row.source,
            "notes": row.notes,
            "owner_id": row.owner_id,
            "status": row.status.value,
            "client_kind": row.client_kind.value,
            "company_legal_name": row.company_legal_name,
            "company_tax_id": row.company_tax_id,
            "marketing_opt_in": row.marketing_opt_in,
            "preferred_marketing_channel": row.preferred_marketing_channel,
        },
    )
    db.commit()
    row = db.scalar(
        select(Lead).options(*_lead_options()).where(Lead.id == row.id),
    )
    assert row is not None
    return LeadOut.model_validate(row)


@router.get("/{lead_id}", response_model=LeadDetailOut)
def get_lead(
    lead_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LeadDetailOut:
    row = _lead_or_404_detail(db, current_user.organization_id, lead_id)
    return _build_lead_detail_out(row)


@router.get("/{lead_id}/profile", response_model=ClientProfileOut)
def get_lead_profile(
    lead_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientProfileOut:
    row = _lead_or_404(db, current_user.organization_id, lead_id)
    prof, score, alerts = profile_bundle_from_raw(row.profile_data)
    return ClientProfileOut(profile=prof, completeness_score=score, alerts=alerts)


@router.patch("/{lead_id}/profile", response_model=ClientProfileOut)
def patch_lead_profile(
    lead_id: uuid.UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientProfileOut:
    org_id = current_user.organization_id
    row = _lead_or_404(db, org_id, lead_id)
    _assert_lead_mutable(row)
    merged = merge_profile_dict(coerce_profile_dict(row.profile_data), body)
    try:
        ClientInsuranceProfile.model_validate(merged)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.errors(include_url=False),
        ) from None
    row.profile_data = merged
    db.commit()
    db.refresh(row)
    prof, score, alerts = profile_bundle_from_raw(row.profile_data)
    return ClientProfileOut(profile=prof, completeness_score=score, alerts=alerts)


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
        "date_of_birth": row.date_of_birth,
        "external_id": row.external_id,
        "source": row.source,
        "notes": row.notes,
        "owner_id": row.owner_id,
        "status": row.status.value,
        "client_kind": row.client_kind.value,
        "company_legal_name": row.company_legal_name,
        "company_tax_id": row.company_tax_id,
        "marketing_opt_in": row.marketing_opt_in,
        "preferred_marketing_channel": row.preferred_marketing_channel,
    }
    data = body.model_dump(exclude_unset=True)
    if "email" in data and data["email"] is not None:
        data["email"] = str(data["email"])
    if "owner_id" in data and data["owner_id"] is not None:
        _user_in_org(db, org_id, data["owner_id"])
    merged_kind = data.get("client_kind", row.client_kind)
    merged_legal = data.get("company_legal_name", row.company_legal_name)
    if merged_kind == ClientKind.COMPANY and not (merged_legal and str(merged_legal).strip()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="company_legal_name is required when client_kind is COMPANY",
        )
    for k, v in data.items():
        setattr(row, k, v)
    db.flush()
    after = {
        "full_name": row.full_name,
        "email": row.email,
        "phone": row.phone,
        "date_of_birth": row.date_of_birth,
        "external_id": row.external_id,
        "source": row.source,
        "notes": row.notes,
        "owner_id": row.owner_id,
        "status": row.status.value,
        "client_kind": row.client_kind.value,
        "company_legal_name": row.company_legal_name,
        "company_tax_id": row.company_tax_id,
        "marketing_opt_in": row.marketing_opt_in,
        "preferred_marketing_channel": row.preferred_marketing_channel,
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


@router.get("/{lead_id}/insured-persons", response_model=list[InsuredPersonOut])
def list_lead_insured_persons(
    lead_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[InsuredPersonOut]:
    org_id = current_user.organization_id
    _lead_or_404(db, org_id, lead_id)
    rows = db.scalars(
        select(InsuredPerson)
        .where(
            InsuredPerson.lead_id == lead_id,
            InsuredPerson.organization_id == org_id,
        )
        .order_by(InsuredPerson.created_at),
    ).all()
    return [InsuredPersonOut.model_validate(r) for r in rows]


@router.post(
    "/{lead_id}/insured-persons",
    response_model=InsuredPersonOut,
    status_code=status.HTTP_201_CREATED,
)
def create_lead_insured_person(
    lead_id: uuid.UUID,
    body: InsuredPersonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InsuredPersonOut:
    org_id = current_user.organization_id
    row_lead = _lead_or_404(db, org_id, lead_id)
    _assert_lead_mutable(row_lead)
    ins_row = InsuredPerson(
        organization_id=org_id,
        lead_id=lead_id,
        client_id=None,
        full_name=body.full_name,
        relation=body.relation,
        notes=body.notes,
    )
    db.add(ins_row)
    db.flush()
    record_entity_snapshot_create(
        db,
        organization_id=org_id,
        actor_user_id=current_user.id,
        entity_type=CrmEntityType.INSURED_PERSON,
        entity_id=ins_row.id,
        snapshot={k: v for k, v in _insured_audit_dict(ins_row).items() if v is not None},
    )
    db.commit()
    db.refresh(ins_row)
    return InsuredPersonOut.model_validate(ins_row)


@router.patch(
    "/{lead_id}/insured-persons/{insured_id}",
    response_model=InsuredPersonOut,
)
def update_lead_insured_person(
    lead_id: uuid.UUID,
    insured_id: uuid.UUID,
    body: InsuredPersonUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InsuredPersonOut:
    org_id = current_user.organization_id
    row_lead = _lead_or_404(db, org_id, lead_id)
    _assert_lead_mutable(row_lead)
    row = db.scalar(
        select(InsuredPerson).where(
            InsuredPerson.id == insured_id,
            InsuredPerson.lead_id == lead_id,
            InsuredPerson.organization_id == org_id,
        ),
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insured person not found",
        )
    before = _insured_audit_dict(row)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    db.flush()
    after = _insured_audit_dict(row)
    updates = {k: after[k] for k in _INSURED_AUDIT_KEYS if before.get(k) != after.get(k)}
    if updates:
        record_field_updates(
            db,
            organization_id=org_id,
            actor_user_id=current_user.id,
            entity_type=CrmEntityType.INSURED_PERSON,
            entity_id=insured_id,
            before=before,
            updates=updates,
        )
    db.commit()
    db.refresh(row)
    return InsuredPersonOut.model_validate(row)


@router.delete(
    "/{lead_id}/insured-persons/{insured_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_lead_insured_person(
    lead_id: uuid.UUID,
    insured_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    org_id = current_user.organization_id
    row_lead = _lead_or_404(db, org_id, lead_id)
    _assert_lead_mutable(row_lead)
    row = db.scalar(
        select(InsuredPerson).where(
            InsuredPerson.id == insured_id,
            InsuredPerson.lead_id == lead_id,
            InsuredPerson.organization_id == org_id,
        ),
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insured person not found",
        )
    record_audit(
        db,
        organization_id=org_id,
        actor_user_id=current_user.id,
        entity_type=CrmEntityType.INSURED_PERSON,
        entity_id=insured_id,
        action=CrmAuditAction.DELETE,
    )
    db.delete(row)
    db.commit()


@router.get("/{lead_id}/held-products", response_model=list[ClientHeldProductOut])
def list_lead_held_products(
    lead_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ClientHeldProductOut]:
    org_id = current_user.organization_id
    _lead_or_404(db, org_id, lead_id)
    rows = db.scalars(
        select(ClientHeldProduct)
        .options(selectinload(ClientHeldProduct.product))
        .where(ClientHeldProduct.lead_id == lead_id)
        .order_by(ClientHeldProduct.created_at.desc()),
    ).all()
    return [ClientHeldProductOut.model_validate(r) for r in rows]


@router.post(
    "/{lead_id}/held-products",
    response_model=ClientHeldProductOut,
    status_code=status.HTTP_201_CREATED,
)
def create_lead_held_product(
    lead_id: uuid.UUID,
    body: ClientHeldProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientHeldProductOut:
    org_id = current_user.organization_id
    row_lead = _lead_or_404(db, org_id, lead_id)
    _assert_lead_mutable(row_lead)
    _product_in_org(db, org_id, body.product_id)
    hp = ClientHeldProduct(
        lead_id=lead_id,
        client_id=None,
        product_id=body.product_id,
        insurer_name=body.insurer_name,
        policy_status=body.policy_status,
        effective_date=body.effective_date,
        end_date=body.end_date,
        ingestion_source=body.ingestion_source,
        notes=body.notes,
    )
    db.add(hp)
    db.commit()
    db.refresh(hp)
    hp = db.scalar(
        select(ClientHeldProduct)
        .options(selectinload(ClientHeldProduct.product))
        .where(ClientHeldProduct.id == hp.id),
    )
    assert hp is not None
    return ClientHeldProductOut.model_validate(hp)


@router.patch("/{lead_id}/held-products/{held_id}", response_model=ClientHeldProductOut)
def update_lead_held_product(
    lead_id: uuid.UUID,
    held_id: uuid.UUID,
    body: ClientHeldProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientHeldProductOut:
    org_id = current_user.organization_id
    row_lead = _lead_or_404(db, org_id, lead_id)
    _assert_lead_mutable(row_lead)
    row = db.scalar(
        select(ClientHeldProduct).where(
            ClientHeldProduct.id == held_id,
            ClientHeldProduct.lead_id == lead_id,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Held product not found")
    data = body.model_dump(exclude_unset=True)
    if "product_id" in data:
        _product_in_org(db, org_id, data["product_id"])
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    row = db.scalar(
        select(ClientHeldProduct)
        .options(selectinload(ClientHeldProduct.product))
        .where(ClientHeldProduct.id == held_id),
    )
    assert row is not None
    return ClientHeldProductOut.model_validate(row)


@router.delete(
    "/{lead_id}/held-products/{held_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_lead_held_product(
    lead_id: uuid.UUID,
    held_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    org_id = current_user.organization_id
    row_lead = _lead_or_404(db, org_id, lead_id)
    _assert_lead_mutable(row_lead)
    row = db.scalar(
        select(ClientHeldProduct).where(
            ClientHeldProduct.id == held_id,
            ClientHeldProduct.lead_id == lead_id,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Held product not found")
    db.delete(row)
    db.commit()


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
        date_of_birth=row.date_of_birth,
        notes=row.notes,
        owner_id=client_owner,
        client_kind=row.client_kind,
        company_legal_name=row.company_legal_name,
        company_tax_id=row.company_tax_id,
        external_id=row.external_id,
        source=row.source,
        marketing_opt_in=row.marketing_opt_in,
        preferred_marketing_channel=row.preferred_marketing_channel,
        profile_data=dict(row.profile_data) if row.profile_data else {},
    )
    db.add(client_row)
    db.flush()

    db.execute(
        update(InsuredPerson)
        .where(
            InsuredPerson.lead_id == lead_id,
            InsuredPerson.organization_id == org_id,
        )
        .values(client_id=client_row.id, lead_id=None),
    )
    db.execute(
        update(ClientHeldProduct)
        .where(ClientHeldProduct.lead_id == lead_id)
        .values(client_id=client_row.id, lead_id=None),
    )

    db.execute(
        update(Opportunity)
        .where(
            Opportunity.lead_id == lead_id,
            Opportunity.organization_id == org_id,
        )
        .values(client_id=client_row.id, lead_id=None),
    )
    db.execute(
        update(Interaction)
        .where(
            Interaction.lead_id == lead_id,
            Interaction.organization_id == org_id,
        )
        .values(client_id=client_row.id, lead_id=None),
    )

    record_entity_snapshot_create(
        db,
        organization_id=org_id,
        actor_user_id=current_user.id,
        entity_type=CrmEntityType.CLIENT,
        entity_id=client_row.id,
        snapshot=_client_snapshot_for_audit(client_row),
    )

    new_opp_id: uuid.UUID | None = None
    opp_out: OpportunityOut | None = None
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
    cid = client_row.id
    client_row = db.scalar(
        select(Client)
        .options(
            joinedload(Client.owner),
            selectinload(Client.insured_persons),
            selectinload(Client.held_products).selectinload(ClientHeldProduct.product),
        )
        .where(Client.id == cid),
    )
    assert client_row is not None
    client_out = _build_client_detail_out(client_row)

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
