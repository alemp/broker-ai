from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import ValidationError
from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.db.enums import AdequacyTrafficLight, ClientKind, CrmAuditAction, CrmEntityType
from ai_copilot_api.db.models import (
    Client,
    ClientAdequacySnapshot,
    ClientHeldProduct,
    CrmAuditEvent,
    InsuredPerson,
    Product,
    User,
)
from ai_copilot_api.db.session import get_db
from ai_copilot_api.domain.adequacy_batch import effective_adequacy_assessment
from ai_copilot_api.domain.client_profile import (
    completeness_score,
    merge_profile_dict,
    parse_profile,
    profile_alerts,
)
from ai_copilot_api.domain.crm_audit import (
    record_audit,
    record_entity_snapshot_create,
    record_field_updates,
)
from ai_copilot_api.schemas.client_profile import ClientInsuranceProfile, ClientProfileOut
from ai_copilot_api.schemas.crm import (
    ClientAdequacyReviewBrief,
    ClientCreate,
    ClientDetailOut,
    ClientHeldProductCreate,
    ClientHeldProductOut,
    ClientHeldProductUpdate,
    ClientOut,
    ClientUpdate,
    CrmAuditEventOut,
    InsuredPersonCreate,
    InsuredPersonOut,
    InsuredPersonUpdate,
)

router = APIRouter(prefix="/clients", tags=["clients"])

_MAX_PAGE = 100

_CLIENT_AUDIT_KEYS = (
    "full_name",
    "email",
    "phone",
    "external_id",
    "notes",
    "owner_id",
    "client_kind",
    "company_legal_name",
    "company_tax_id",
    "marketing_opt_in",
    "preferred_marketing_channel",
)


def _client_audit_dict(row: Client) -> dict:
    return {
        "full_name": row.full_name,
        "email": row.email,
        "phone": row.phone,
        "external_id": row.external_id,
        "notes": row.notes,
        "owner_id": row.owner_id,
        "client_kind": row.client_kind.value,
        "company_legal_name": row.company_legal_name,
        "company_tax_id": row.company_tax_id,
        "marketing_opt_in": row.marketing_opt_in,
        "preferred_marketing_channel": row.preferred_marketing_channel,
    }


def _user_in_org(db: Session, org_id: uuid.UUID, user_id: uuid.UUID) -> None:
    u = db.scalar(select(User).where(User.id == user_id, User.organization_id == org_id))
    if u is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")


def _raw_profile_data(row: Client) -> dict[str, Any]:
    raw = row.profile_data
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    return {}


def _client_profile_bundle(row: Client) -> tuple[ClientInsuranceProfile, int, list[str]]:
    prof = parse_profile(_raw_profile_data(row))
    return prof, completeness_score(prof), profile_alerts(prof)


def _build_client_detail_out(row: Client) -> ClientDetailOut:
    prof, score, alerts = _client_profile_bundle(row)
    base = ClientOut.model_validate(row)
    insured = getattr(row, "insured_persons", []) or []
    return ClientDetailOut(
        **base.model_dump(),
        held_products=[ClientHeldProductOut.model_validate(h) for h in row.held_products],
        insured_persons=[InsuredPersonOut.model_validate(p) for p in insured],
        profile=prof,
        profile_completeness_score=score,
        profile_alerts=alerts,
    )


def _client_or_404(db: Session, org_id: uuid.UUID, client_id: uuid.UUID) -> Client:
    row = db.scalar(
        select(Client).where(Client.id == client_id, Client.organization_id == org_id),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return row


def _product_in_org_or_404(db: Session, org_id: uuid.UUID, product_id: uuid.UUID | None) -> None:
    if product_id is None:
        return
    p = db.scalar(
        select(Product).where(Product.id == product_id, Product.organization_id == org_id),
    )
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")


@router.get("", response_model=list[ClientOut])
def list_clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=_MAX_PAGE),
    q: str | None = Query(default=None, max_length=200),
    adequacy_traffic_light: AdequacyTrafficLight | None = Query(
        default=None,
        description="When set, only clients whose last batch snapshot matches this semáforo",
    ),
) -> list[ClientOut]:
    stmt = (
        select(Client)
        .options(joinedload(Client.owner))
        .where(Client.organization_id == current_user.organization_id)
    )
    if q and q.strip():
        pat = f"%{q.strip()}%"
        stmt = stmt.where(or_(Client.full_name.ilike(pat), Client.email.ilike(pat)))
    if adequacy_traffic_light is not None:
        stmt = stmt.join(ClientAdequacySnapshot).where(
            ClientAdequacySnapshot.traffic_light == adequacy_traffic_light,
        )
    stmt = stmt.order_by(Client.updated_at.desc()).offset(skip).limit(limit)
    rows = db.scalars(stmt).unique().all()
    ids = [r.id for r in rows]
    snaps: dict[uuid.UUID, ClientAdequacySnapshot] = {}
    if ids:
        for snap in db.scalars(
            select(ClientAdequacySnapshot).where(ClientAdequacySnapshot.client_id.in_(ids)),
        ).all():
            snaps[snap.client_id] = snap
    out: list[ClientOut] = []
    for r in rows:
        base = ClientOut.model_validate(r)
        s = snaps.get(r.id)
        if s is not None:
            out.append(
                base.model_copy(
                    update={
                        "adequacy_traffic_light": s.traffic_light,
                        "adequacy_computed_at": s.computed_at,
                    },
                ),
            )
        else:
            out.append(base)
    return out


@router.get("/adequacy-review-queue", response_model=list[ClientAdequacyReviewBrief])
def list_adequacy_review_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=_MAX_PAGE),
) -> list[ClientAdequacyReviewBrief]:
    """Clients with non-GREEN adequacy (§5.8 review queue) — MVP scan."""
    stmt = (
        select(Client)
        .options(
            selectinload(Client.held_products).selectinload(ClientHeldProduct.product),
        )
        .where(Client.organization_id == current_user.organization_id)
        .order_by(Client.updated_at.desc())
        .limit(limit * 4)
    )
    rows = db.scalars(stmt).unique().all()
    out: list[ClientAdequacyReviewBrief] = []
    for row in rows:
        ad = effective_adequacy_assessment(db, row)
        if not ad.needs_human_review:
            continue
        out.append(
            ClientAdequacyReviewBrief(
                client_id=row.id,
                full_name=row.full_name,
                traffic_light=ad.traffic_light,
                summary=ad.summary,
                needs_human_review=ad.needs_human_review,
            ),
        )
        if len(out) >= limit:
            break
    return out


@router.post("", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
def create_client(
    body: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientOut:
    org_id = current_user.organization_id
    if body.owner_id is not None:
        _user_in_org(db, org_id, body.owner_id)
    row = Client(
        organization_id=org_id,
        full_name=body.full_name,
        email=str(body.email) if body.email is not None else None,
        phone=body.phone,
        external_id=body.external_id,
        notes=body.notes,
        owner_id=body.owner_id,
        client_kind=body.client_kind,
        company_legal_name=body.company_legal_name,
        company_tax_id=body.company_tax_id,
        marketing_opt_in=body.marketing_opt_in,
        preferred_marketing_channel=body.preferred_marketing_channel,
    )
    db.add(row)
    try:
        db.flush()
        record_entity_snapshot_create(
            db,
            organization_id=org_id,
            actor_user_id=current_user.id,
            entity_type=CrmEntityType.CLIENT,
            entity_id=row.id,
            snapshot={k: v for k, v in _client_audit_dict(row).items() if v is not None},
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Client violates unique email or external_id for this organization",
        ) from None
    row = db.scalar(
        select(Client).options(joinedload(Client.owner)).where(Client.id == row.id),
    )
    assert row is not None
    return ClientOut.model_validate(row)


@router.get("/{client_id}", response_model=ClientDetailOut)
def get_client(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientDetailOut:
    row = db.scalar(
        select(Client)
        .options(
            joinedload(Client.owner),
            selectinload(Client.insured_persons),
            selectinload(Client.held_products).selectinload(ClientHeldProduct.product),
        )
        .where(
            Client.id == client_id,
            Client.organization_id == current_user.organization_id,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return _build_client_detail_out(row)


@router.get("/{client_id}/profile", response_model=ClientProfileOut)
def get_client_profile(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientProfileOut:
    row = _client_or_404(db, current_user.organization_id, client_id)
    prof, score, alerts = _client_profile_bundle(row)
    return ClientProfileOut(profile=prof, completeness_score=score, alerts=alerts)


@router.patch("/{client_id}/profile", response_model=ClientProfileOut)
def patch_client_profile(
    client_id: uuid.UUID,
    body: dict[str, Any] = Body(default_factory=dict),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientProfileOut:
    row = _client_or_404(db, current_user.organization_id, client_id)
    merged = merge_profile_dict(_raw_profile_data(row), body)
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
    prof, score, alerts = _client_profile_bundle(row)
    return ClientProfileOut(profile=prof, completeness_score=score, alerts=alerts)


@router.patch("/{client_id}", response_model=ClientOut)
def update_client(
    client_id: uuid.UUID,
    body: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientOut:
    org_id = current_user.organization_id
    row = _client_or_404(db, org_id, client_id)
    before = _client_audit_dict(row)
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
    try:
        db.flush()
        after = _client_audit_dict(row)
        updates = {k: after[k] for k in _CLIENT_AUDIT_KEYS if before.get(k) != after.get(k)}
        if updates:
            record_field_updates(
                db,
                organization_id=org_id,
                actor_user_id=current_user.id,
                entity_type=CrmEntityType.CLIENT,
                entity_id=client_id,
                before=before,
                updates=updates,
            )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Client violates unique email or external_id for this organization",
        ) from None
    row = db.scalar(
        select(Client).options(joinedload(Client.owner)).where(Client.id == client_id),
    )
    assert row is not None
    return ClientOut.model_validate(row)


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    org_id = current_user.organization_id
    row = _client_or_404(db, org_id, client_id)
    record_audit(
        db,
        organization_id=org_id,
        actor_user_id=current_user.id,
        entity_type=CrmEntityType.CLIENT,
        entity_id=client_id,
        action=CrmAuditAction.DELETE,
    )
    db.delete(row)
    db.commit()


_INSURED_AUDIT_KEYS = ("full_name", "relation", "notes", "client_id")


def _insured_audit_dict(row: InsuredPerson) -> dict:
    return {
        "full_name": row.full_name,
        "relation": row.relation.value,
        "notes": row.notes,
        "client_id": row.client_id,
    }


@router.get("/{client_id}/audit-events", response_model=list[CrmAuditEventOut])
def list_client_audit_events(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[CrmAuditEventOut]:
    org_id = current_user.organization_id
    _client_or_404(db, org_id, client_id)
    insured_subq = select(InsuredPerson.id).where(
        InsuredPerson.client_id == client_id,
        InsuredPerson.organization_id == org_id,
    )
    rows = db.scalars(
        select(CrmAuditEvent)
        .where(
            CrmAuditEvent.organization_id == org_id,
            or_(
                and_(
                    CrmAuditEvent.entity_type == CrmEntityType.CLIENT,
                    CrmAuditEvent.entity_id == client_id,
                ),
                and_(
                    CrmAuditEvent.entity_type == CrmEntityType.INSURED_PERSON,
                    CrmAuditEvent.entity_id.in_(insured_subq),
                ),
            ),
        )
        .order_by(CrmAuditEvent.created_at.desc())
        .limit(limit),
    ).all()
    return [CrmAuditEventOut.model_validate(r) for r in rows]


@router.get("/{client_id}/insured-persons", response_model=list[InsuredPersonOut])
def list_insured_persons(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[InsuredPersonOut]:
    org_id = current_user.organization_id
    _client_or_404(db, org_id, client_id)
    rows = db.scalars(
        select(InsuredPerson)
        .where(
            InsuredPerson.client_id == client_id,
            InsuredPerson.organization_id == org_id,
        )
        .order_by(InsuredPerson.created_at),
    ).all()
    return [InsuredPersonOut.model_validate(r) for r in rows]


@router.post(
    "/{client_id}/insured-persons",
    response_model=InsuredPersonOut,
    status_code=status.HTTP_201_CREATED,
)
def create_insured_person(
    client_id: uuid.UUID,
    body: InsuredPersonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InsuredPersonOut:
    org_id = current_user.organization_id
    _client_or_404(db, org_id, client_id)
    row = InsuredPerson(
        organization_id=org_id,
        client_id=client_id,
        full_name=body.full_name,
        relation=body.relation,
        notes=body.notes,
    )
    db.add(row)
    db.flush()
    record_entity_snapshot_create(
        db,
        organization_id=org_id,
        actor_user_id=current_user.id,
        entity_type=CrmEntityType.INSURED_PERSON,
        entity_id=row.id,
        snapshot={k: v for k, v in _insured_audit_dict(row).items() if v is not None},
    )
    db.commit()
    db.refresh(row)
    return InsuredPersonOut.model_validate(row)


@router.patch(
    "/{client_id}/insured-persons/{insured_id}",
    response_model=InsuredPersonOut,
)
def update_insured_person(
    client_id: uuid.UUID,
    insured_id: uuid.UUID,
    body: InsuredPersonUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InsuredPersonOut:
    org_id = current_user.organization_id
    _client_or_404(db, org_id, client_id)
    row = db.scalar(
        select(InsuredPerson).where(
            InsuredPerson.id == insured_id,
            InsuredPerson.client_id == client_id,
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
    "/{client_id}/insured-persons/{insured_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_insured_person(
    client_id: uuid.UUID,
    insured_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    org_id = current_user.organization_id
    _client_or_404(db, org_id, client_id)
    row = db.scalar(
        select(InsuredPerson).where(
            InsuredPerson.id == insured_id,
            InsuredPerson.client_id == client_id,
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


@router.get("/{client_id}/held-products", response_model=list[ClientHeldProductOut])
def list_client_held_products(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ClientHeldProductOut]:
    _client_or_404(db, current_user.organization_id, client_id)
    rows = db.scalars(
        select(ClientHeldProduct)
        .options(selectinload(ClientHeldProduct.product))
        .where(ClientHeldProduct.client_id == client_id)
        .order_by(ClientHeldProduct.created_at.desc()),
    ).all()
    return [ClientHeldProductOut.model_validate(r) for r in rows]


@router.post(
    "/{client_id}/held-products",
    response_model=ClientHeldProductOut,
    status_code=status.HTTP_201_CREATED,
)
def create_client_held_product(
    client_id: uuid.UUID,
    body: ClientHeldProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientHeldProductOut:
    _client_or_404(db, current_user.organization_id, client_id)
    _product_in_org_or_404(db, current_user.organization_id, body.product_id)
    row = ClientHeldProduct(
        client_id=client_id,
        product_id=body.product_id,
        insurer_name=body.insurer_name,
        policy_status=body.policy_status,
        effective_date=body.effective_date,
        end_date=body.end_date,
        ingestion_source=body.ingestion_source,
        notes=body.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    row = db.scalar(
        select(ClientHeldProduct)
        .options(selectinload(ClientHeldProduct.product))
        .where(ClientHeldProduct.id == row.id),
    )
    assert row is not None
    return ClientHeldProductOut.model_validate(row)


@router.patch("/{client_id}/held-products/{held_id}", response_model=ClientHeldProductOut)
def update_client_held_product(
    client_id: uuid.UUID,
    held_id: uuid.UUID,
    body: ClientHeldProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientHeldProductOut:
    _client_or_404(db, current_user.organization_id, client_id)
    row = db.scalar(
        select(ClientHeldProduct).where(
            ClientHeldProduct.id == held_id,
            ClientHeldProduct.client_id == client_id,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Held product not found")
    data = body.model_dump(exclude_unset=True)
    if "product_id" in data:
        _product_in_org_or_404(db, current_user.organization_id, data["product_id"])
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
    "/{client_id}/held-products/{held_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_client_held_product(
    client_id: uuid.UUID,
    held_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    _client_or_404(db, current_user.organization_id, client_id)
    row = db.scalar(
        select(ClientHeldProduct).where(
            ClientHeldProduct.id == held_id,
            ClientHeldProduct.client_id == client_id,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Held product not found")
    db.delete(row)
    db.commit()
