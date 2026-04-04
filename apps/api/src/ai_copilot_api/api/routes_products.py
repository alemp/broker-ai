from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.db.models import Product, User
from ai_copilot_api.db.session import get_db
from ai_copilot_api.schemas.crm import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def list_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_only: bool = Query(default=True),
) -> list[ProductOut]:
    stmt = select(Product).where(Product.organization_id == current_user.organization_id)
    if active_only:
        stmt = stmt.where(Product.active.is_(True))
    stmt = stmt.order_by(Product.name)
    rows = db.scalars(stmt).all()
    return [ProductOut.model_validate(r) for r in rows]


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    body: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProductOut:
    row = Product(
        organization_id=current_user.organization_id,
        name=body.name,
        category=body.category,
        description=body.description,
        risk_level=body.risk_level,
        target_tags=body.target_tags,
        active=body.active,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ProductOut.model_validate(row)


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProductOut:
    row = db.scalar(
        select(Product).where(
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
    row = db.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.organization_id == current_user.organization_id,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
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
