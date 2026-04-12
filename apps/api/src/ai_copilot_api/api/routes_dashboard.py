"""Phase 9 — dashboard aggregates (adequacy semáforo counts, last job)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.db.enums import AdequacyTrafficLight, BatchJobStatus
from ai_copilot_api.db.models import BatchJobRun, Client, ClientAdequacySnapshot, User
from ai_copilot_api.db.session import get_db
from ai_copilot_api.domain.adequacy_batch import JOB_TYPE_ADEQUACY_REFRESH
from ai_copilot_api.schemas.crm import AdequacyDashboardSummaryOut, BatchJobRunOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/adequacy-summary", response_model=AdequacyDashboardSummaryOut)
def get_adequacy_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdequacyDashboardSummaryOut:
    org_id = current_user.organization_id
    total_clients = (
        db.scalar(
            select(func.count()).select_from(Client).where(Client.organization_id == org_id),
        )
        or 0
    )

    rows = db.execute(
        select(ClientAdequacySnapshot.traffic_light, func.count())
        .where(ClientAdequacySnapshot.organization_id == org_id)
        .group_by(ClientAdequacySnapshot.traffic_light),
    ).all()
    by_light: dict[AdequacyTrafficLight, int] = {r[0]: int(r[1]) for r in rows}
    snap_total = sum(by_light.values())
    green = by_light.get(AdequacyTrafficLight.GREEN, 0)
    yellow = by_light.get(AdequacyTrafficLight.YELLOW, 0)
    red = by_light.get(AdequacyTrafficLight.RED, 0)

    last = db.scalar(
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

    return AdequacyDashboardSummaryOut(
        total_clients=total_clients,
        snapshot_green=green,
        snapshot_yellow=yellow,
        snapshot_red=red,
        clients_without_snapshot=max(0, total_clients - snap_total),
        last_job=BatchJobRunOut.model_validate(last) if last is not None else None,
    )
