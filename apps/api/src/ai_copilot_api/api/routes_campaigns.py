from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.db.enums import CampaignTouchStatus
from ai_copilot_api.db.models import Campaign, CampaignTouch, User
from ai_copilot_api.db.session import get_db
from ai_copilot_api.domain.campaign_segmentation import clients_matching_segment_criteria
from ai_copilot_api.schemas.crm import (
    CampaignCreate,
    CampaignOut,
    CampaignSegmentRefreshIn,
    CampaignTouchOut,
    CampaignTouchPatch,
    CampaignUpdate,
)

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

_MAX_PAGE = 100


@router.get("", response_model=list[CampaignOut])
def list_campaigns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_only: bool = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=_MAX_PAGE),
) -> list[CampaignOut]:
    stmt = select(Campaign).where(Campaign.organization_id == current_user.organization_id)
    if active_only:
        stmt = stmt.where(Campaign.active.is_(True))
    stmt = stmt.order_by(Campaign.updated_at.desc()).offset(skip).limit(limit)
    rows = db.scalars(stmt).all()
    return [CampaignOut.model_validate(r) for r in rows]


@router.post("", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
def create_campaign(
    body: CampaignCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CampaignOut:
    row = Campaign(
        organization_id=current_user.organization_id,
        name=body.name,
        kind=body.kind,
        description=body.description,
        template_subject=body.template_subject,
        template_body=body.template_body,
        segment_criteria=body.segment_criteria,
        active=body.active,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return CampaignOut.model_validate(row)


@router.get("/{campaign_id}", response_model=CampaignOut)
def get_campaign(
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CampaignOut:
    row = db.scalar(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.organization_id == current_user.organization_id,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return CampaignOut.model_validate(row)


@router.patch("/{campaign_id}", response_model=CampaignOut)
def update_campaign(
    campaign_id: uuid.UUID,
    body: CampaignUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CampaignOut:
    row = db.scalar(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.organization_id == current_user.organization_id,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return CampaignOut.model_validate(row)


@router.post("/{campaign_id}/segment-refresh", response_model=list[CampaignTouchOut])
def refresh_campaign_segment(
    campaign_id: uuid.UUID,
    body: CampaignSegmentRefreshIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CampaignTouchOut]:
    org_id = current_user.organization_id
    row = db.scalar(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.organization_id == org_id,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    when = body.scheduled_at or datetime.now(UTC)
    audience = clients_matching_segment_criteria(db, org_id, row.segment_criteria or {})
    created: list[CampaignTouch] = []
    for c in audience:
        touch = CampaignTouch(
            campaign_id=row.id,
            client_id=c.id,
            scheduled_at=when,
            status=CampaignTouchStatus.PENDING,
            channel=body.channel,
        )
        db.add(touch)
        created.append(touch)
    db.commit()
    for t in created:
        db.refresh(t)
    return [CampaignTouchOut.model_validate(t) for t in created]


@router.get("/{campaign_id}/touches", response_model=list[CampaignTouchOut])
def list_campaign_touches(
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=_MAX_PAGE),
) -> list[CampaignTouchOut]:
    org_id = current_user.organization_id
    c = db.scalar(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.organization_id == org_id),
    )
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    stmt = (
        select(CampaignTouch)
        .where(CampaignTouch.campaign_id == campaign_id)
        .order_by(CampaignTouch.scheduled_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = db.scalars(stmt).all()
    return [CampaignTouchOut.model_validate(r) for r in rows]


@router.patch("/{campaign_id}/touches/{touch_id}", response_model=CampaignTouchOut)
def patch_campaign_touch(
    campaign_id: uuid.UUID,
    touch_id: uuid.UUID,
    body: CampaignTouchPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CampaignTouchOut:
    org_id = current_user.organization_id
    c = db.scalar(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.organization_id == org_id),
    )
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    t = db.scalar(
        select(CampaignTouch).where(
            CampaignTouch.id == touch_id,
            CampaignTouch.campaign_id == campaign_id,
        ),
    )
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Touch not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return CampaignTouchOut.model_validate(t)
