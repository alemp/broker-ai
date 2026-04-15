from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ai_copilot_api.api.deps import get_current_user, require_admin
from ai_copilot_api.db.models import CoverageTaxonomy, User
from ai_copilot_api.db.session import get_db
from ai_copilot_api.schemas.coverage_taxonomy import (
    CoverageTaxonomyCreate,
    CoverageTaxonomyOut,
    CoverageTaxonomyUpdate,
)

router = APIRouter(prefix="/coverage-taxonomy", tags=["coverage-taxonomy"])


@router.get("", response_model=list[CoverageTaxonomyOut])
def list_coverage_taxonomy(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CoverageTaxonomyOut]:
    stmt = (
        select(CoverageTaxonomy)
        .where(CoverageTaxonomy.organization_id == current_user.organization_id)
        .order_by(CoverageTaxonomy.code)
    )
    rows = db.scalars(stmt).all()
    return [CoverageTaxonomyOut.model_validate(r) for r in rows]


@router.post("", response_model=CoverageTaxonomyOut, status_code=status.HTTP_201_CREATED)
def create_coverage_taxonomy(
    body: CoverageTaxonomyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> CoverageTaxonomyOut:
    row = CoverageTaxonomy(
        organization_id=current_user.organization_id,
        code=body.code.strip(),
        label=body.label.strip(),
        synonyms=body.synonyms,
        active=body.active,
    )
    db.add(row)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(row)
    return CoverageTaxonomyOut.model_validate(row)


@router.patch("/{taxonomy_id}", response_model=CoverageTaxonomyOut)
def update_coverage_taxonomy(
    taxonomy_id: uuid.UUID,
    body: CoverageTaxonomyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> CoverageTaxonomyOut:
    row = db.scalar(
        select(CoverageTaxonomy).where(
            CoverageTaxonomy.id == taxonomy_id,
            CoverageTaxonomy.organization_id == current_user.organization_id,
        ),
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Taxonomy entry not found",
        )
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return CoverageTaxonomyOut.model_validate(row)

