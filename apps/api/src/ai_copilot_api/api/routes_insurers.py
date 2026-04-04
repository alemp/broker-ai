from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.db.models import Insurer, User
from ai_copilot_api.db.session import get_db
from ai_copilot_api.schemas.crm import InsurerCreate, InsurerOut, InsurerUpdate

router = APIRouter(prefix="/insurers", tags=["insurers"])


@router.get("", response_model=list[InsurerOut])
def list_insurers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_only: bool = Query(default=True),
    q: str | None = Query(default=None, max_length=255),
) -> list[InsurerOut]:
    stmt = select(Insurer).where(Insurer.organization_id == current_user.organization_id)
    if active_only:
        stmt = stmt.where(Insurer.active.is_(True))
    if q and q.strip():
        pat = f"%{q.strip()}%"
        stmt = stmt.where(Insurer.name.ilike(pat))
    stmt = stmt.order_by(Insurer.name)
    rows = db.scalars(stmt).all()
    return [InsurerOut.model_validate(r) for r in rows]


@router.post("", response_model=InsurerOut, status_code=status.HTTP_201_CREATED)
def create_insurer(
    body: InsurerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InsurerOut:
    row = Insurer(
        organization_id=current_user.organization_id,
        name=body.name,
        code=body.code,
        active=body.active,
        notes=body.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return InsurerOut.model_validate(row)


@router.get("/{insurer_id}", response_model=InsurerOut)
def get_insurer(
    insurer_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InsurerOut:
    row = db.scalar(
        select(Insurer).where(
            Insurer.id == insurer_id,
            Insurer.organization_id == current_user.organization_id,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insurer not found")
    return InsurerOut.model_validate(row)


@router.patch("/{insurer_id}", response_model=InsurerOut)
def update_insurer(
    insurer_id: uuid.UUID,
    body: InsurerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InsurerOut:
    row = db.scalar(
        select(Insurer).where(
            Insurer.id == insurer_id,
            Insurer.organization_id == current_user.organization_id,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insurer not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return InsurerOut.model_validate(row)
