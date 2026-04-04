from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.db.models import Insurer, LineOfBusiness, Product, User
from ai_copilot_api.db.session import get_db
from ai_copilot_api.schemas.crm import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


def _insurer_in_org(db: Session, org_id: uuid.UUID, insurer_id: uuid.UUID) -> None:
    r = db.scalar(
        select(Insurer).where(Insurer.id == insurer_id, Insurer.organization_id == org_id),
    )
    if r is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insurer not found")


def _lob_in_org(db: Session, org_id: uuid.UUID, lob_id: uuid.UUID) -> None:
    r = db.scalar(
        select(LineOfBusiness).where(
            LineOfBusiness.id == lob_id,
            LineOfBusiness.organization_id == org_id,
        ),
    )
    if r is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Line of business not found"
        )


@router.get("", response_model=list[ProductOut])
def list_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_only: bool = Query(default=True),
    q: str | None = Query(default=None, max_length=255),
) -> list[ProductOut]:
    stmt = (
        select(Product)
        .options(joinedload(Product.insurer))
        .where(Product.organization_id == current_user.organization_id)
    )
    if active_only:
        stmt = stmt.where(Product.active.is_(True))
    if q and q.strip():
        pat = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Product.name.ilike(pat),
                Product.description.ilike(pat),
                Product.main_coverage_summary.ilike(pat),
                Product.commercial_arguments.ilike(pat),
            ),
        )
    stmt = stmt.order_by(Product.name)
    rows = db.scalars(stmt).unique().all()
    return [ProductOut.model_validate(r) for r in rows]


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    body: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProductOut:
    org_id = current_user.organization_id
    if body.insurer_id is not None:
        _insurer_in_org(db, org_id, body.insurer_id)
    if body.line_of_business_id is not None:
        _lob_in_org(db, org_id, body.line_of_business_id)
    row = Product(
        organization_id=org_id,
        name=body.name,
        category=body.category,
        description=body.description,
        risk_level=body.risk_level,
        target_tags=body.target_tags,
        active=body.active,
        insurer_id=body.insurer_id,
        line_of_business_id=body.line_of_business_id,
        main_coverage_summary=body.main_coverage_summary,
        additional_coverages=body.additional_coverages or [],
        exclusions_notes=body.exclusions_notes,
        recommended_profile_summary=body.recommended_profile_summary,
        commercial_arguments=body.commercial_arguments,
        support_materials=body.support_materials or [],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    row = db.scalar(
        select(Product).options(joinedload(Product.insurer)).where(Product.id == row.id),
    )
    assert row is not None
    return ProductOut.model_validate(row)


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProductOut:
    row = db.scalar(
        select(Product)
        .options(joinedload(Product.insurer))
        .where(
            Product.id == product_id,
            Product.organization_id == current_user.organization_id,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return ProductOut.model_validate(row)


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: uuid.UUID,
    body: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProductOut:
    org_id = current_user.organization_id
    row = db.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.organization_id == org_id,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    data = body.model_dump(exclude_unset=True)
    if "insurer_id" in data and data["insurer_id"] is not None:
        _insurer_in_org(db, org_id, data["insurer_id"])
    if "line_of_business_id" in data and data["line_of_business_id"] is not None:
        _lob_in_org(db, org_id, data["line_of_business_id"])
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    row = db.scalar(
        select(Product).options(joinedload(Product.insurer)).where(Product.id == product_id),
    )
    assert row is not None
    return ProductOut.model_validate(row)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    row = db.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.organization_id == current_user.organization_id,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    row.active = False
    db.commit()
