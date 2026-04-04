from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.db.models import LineOfBusiness, User
from ai_copilot_api.db.session import get_db
from ai_copilot_api.schemas.crm import (
    LineOfBusinessCreate,
    LineOfBusinessOut,
    LineOfBusinessUpdate,
)

router = APIRouter(prefix="/lines-of-business", tags=["lines-of-business"])


@router.get("", response_model=list[LineOfBusinessOut])
def list_lines_of_business(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LineOfBusinessOut]:
    rows = db.scalars(
        select(LineOfBusiness)
        .where(LineOfBusiness.organization_id == current_user.organization_id)
        .order_by(LineOfBusiness.code),
    ).all()
    return [LineOfBusinessOut.model_validate(r) for r in rows]


@router.post("", response_model=LineOfBusinessOut, status_code=status.HTTP_201_CREATED)
def create_line_of_business(
    body: LineOfBusinessCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LineOfBusinessOut:
    row = LineOfBusiness(
        organization_id=current_user.organization_id,
        code=body.code.strip().upper(),
        name=body.name,
        description=body.description,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Line of business code already exists for this organization",
        ) from None
    db.refresh(row)
    return LineOfBusinessOut.model_validate(row)


@router.get("/{lob_id}", response_model=LineOfBusinessOut)
def get_line_of_business(
    lob_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LineOfBusinessOut:
    row = db.scalar(
        select(LineOfBusiness).where(
            LineOfBusiness.id == lob_id,
            LineOfBusiness.organization_id == current_user.organization_id,
        ),
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Line of business not found",
        )
    return LineOfBusinessOut.model_validate(row)


@router.patch("/{lob_id}", response_model=LineOfBusinessOut)
def update_line_of_business(
    lob_id: uuid.UUID,
    body: LineOfBusinessUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LineOfBusinessOut:
    row = db.scalar(
        select(LineOfBusiness).where(
            LineOfBusiness.id == lob_id,
            LineOfBusiness.organization_id == current_user.organization_id,
        ),
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Line of business not found",
        )
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return LineOfBusinessOut.model_validate(row)


@router.delete("/{lob_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_line_of_business(
    lob_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    row = db.scalar(
        select(LineOfBusiness).where(
            LineOfBusiness.id == lob_id,
            LineOfBusiness.organization_id == current_user.organization_id,
        ),
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Line of business not found",
        )
    db.delete(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Line of business is still linked to clients",
        ) from None
