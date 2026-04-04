from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import ValidationError
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.db.models import (
    Client,
    ClientHeldProduct,
    ClientLineOfBusiness,
    LineOfBusiness,
    Product,
    User,
)
from ai_copilot_api.db.session import get_db
from ai_copilot_api.domain.client_profile import (
    completeness_score,
    merge_profile_dict,
    parse_profile,
    profile_alerts,
)
from ai_copilot_api.schemas.client_profile import ClientInsuranceProfile, ClientProfileOut
from ai_copilot_api.schemas.crm import (
    ClientCreate,
    ClientDetailOut,
    ClientHeldProductCreate,
    ClientHeldProductOut,
    ClientHeldProductUpdate,
    ClientLineOfBusinessCreate,
    ClientLineOfBusinessOut,
    ClientOut,
    ClientUpdate,
)

router = APIRouter(prefix="/clients", tags=["clients"])

_MAX_PAGE = 100


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
    return ClientDetailOut(
        **base.model_dump(),
        lines_of_business=[
            ClientLineOfBusinessOut.model_validate(link) for link in row.line_of_business_links
        ],
        held_products=[ClientHeldProductOut.model_validate(h) for h in row.held_products],
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


def _lob_in_org_or_404(db: Session, org_id: uuid.UUID, lob_id: uuid.UUID) -> None:
    lob = db.scalar(
        select(LineOfBusiness).where(
            LineOfBusiness.id == lob_id,
            LineOfBusiness.organization_id == org_id,
        ),
    )
    if lob is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Line of business not found",
        )


@router.get("", response_model=list[ClientOut])
def list_clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=_MAX_PAGE),
    q: str | None = Query(default=None, max_length=200),
) -> list[ClientOut]:
    stmt = select(Client).where(Client.organization_id == current_user.organization_id)
    if q and q.strip():
        pat = f"%{q.strip()}%"
        stmt = stmt.where(or_(Client.full_name.ilike(pat), Client.email.ilike(pat)))
    stmt = stmt.order_by(Client.updated_at.desc()).offset(skip).limit(limit)
    rows = db.scalars(stmt).all()
    return [ClientOut.model_validate(r) for r in rows]


@router.post("", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
def create_client(
    body: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientOut:
    row = Client(
        organization_id=current_user.organization_id,
        full_name=body.full_name,
        email=str(body.email) if body.email is not None else None,
        phone=body.phone,
        external_id=body.external_id,
        notes=body.notes,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Client violates unique email or external_id for this organization",
        ) from None
    db.refresh(row)
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
            selectinload(Client.line_of_business_links).selectinload(
                ClientLineOfBusiness.line_of_business
            ),
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
    row = _client_or_404(db, current_user.organization_id, client_id)
    data = body.model_dump(exclude_unset=True)
    if "email" in data and data["email"] is not None:
        data["email"] = str(data["email"])
    for k, v in data.items():
        setattr(row, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Client violates unique email or external_id for this organization",
        ) from None
    db.refresh(row)
    return ClientOut.model_validate(row)


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    row = _client_or_404(db, current_user.organization_id, client_id)
    db.delete(row)
    db.commit()


@router.get("/{client_id}/lines-of-business", response_model=list[ClientLineOfBusinessOut])
def list_client_lines_of_business(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ClientLineOfBusinessOut]:
    _client_or_404(db, current_user.organization_id, client_id)
    rows = db.scalars(
        select(ClientLineOfBusiness)
        .options(selectinload(ClientLineOfBusiness.line_of_business))
        .where(ClientLineOfBusiness.client_id == client_id)
        .order_by(ClientLineOfBusiness.created_at),
    ).all()
    return [ClientLineOfBusinessOut.model_validate(r) for r in rows]


@router.post(
    "/{client_id}/lines-of-business",
    response_model=ClientLineOfBusinessOut,
    status_code=status.HTTP_201_CREATED,
)
def add_client_line_of_business(
    client_id: uuid.UUID,
    body: ClientLineOfBusinessCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientLineOfBusinessOut:
    _client_or_404(db, current_user.organization_id, client_id)
    _lob_in_org_or_404(db, current_user.organization_id, body.line_of_business_id)
    link = ClientLineOfBusiness(
        client_id=client_id,
        line_of_business_id=body.line_of_business_id,
        ingestion_source=body.ingestion_source,
    )
    db.add(link)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Client already linked to this line of business",
        ) from None
    db.refresh(link)
    link = db.scalar(
        select(ClientLineOfBusiness)
        .options(selectinload(ClientLineOfBusiness.line_of_business))
        .where(ClientLineOfBusiness.id == link.id),
    )
    assert link is not None
    return ClientLineOfBusinessOut.model_validate(link)


@router.delete(
    "/{client_id}/lines-of-business/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_client_line_of_business(
    client_id: uuid.UUID,
    link_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    _client_or_404(db, current_user.organization_id, client_id)
    link = db.scalar(
        select(ClientLineOfBusiness).where(
            ClientLineOfBusiness.id == link_id,
            ClientLineOfBusiness.client_id == client_id,
        ),
    )
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")
    db.delete(link)
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
