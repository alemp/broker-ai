"""Phase 9 — manual batch job triggers + async job status."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.db.enums import BatchJobStatus
from ai_copilot_api.db.models import BatchJobRun, User
from ai_copilot_api.db.session import get_db
from ai_copilot_api.domain.adequacy_batch import (
    JOB_TYPE_ADEQUACY_REFRESH,
    refresh_adequacy_for_organization,
)
from ai_copilot_api.schemas.crm import BatchJobRunOut

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post(
    "/adequacy-refresh",
    response_model=BatchJobRunOut,
    status_code=status.HTTP_200_OK,
)
def post_adequacy_refresh(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BatchJobRun:
    """Recompute stored adequacy snapshots for all clients in the organization."""
    return refresh_adequacy_for_organization(db, current_user.organization_id)


@router.get("/adequacy-refresh/last", response_model=BatchJobRunOut | None)
def get_last_adequacy_refresh(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BatchJobRun | None:
    """Most recent completed adequacy batch job for this org (SUCCESS or FAILED)."""
    org_id = current_user.organization_id
    return db.scalar(
        select(BatchJobRun)
        .where(
            BatchJobRun.organization_id == org_id,
            BatchJobRun.job_type == JOB_TYPE_ADEQUACY_REFRESH,
            BatchJobRun.finished_at.isnot(None),
            BatchJobRun.status != BatchJobStatus.RUNNING,
        )
        .order_by(BatchJobRun.finished_at.desc())
        .limit(1),
    )


@router.get("/{job_id}", response_model=BatchJobRunOut)
def get_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BatchJobRun:
    row = db.scalar(
        select(BatchJobRun).where(
            BatchJobRun.id == job_id,
            BatchJobRun.organization_id == current_user.organization_id,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return row
