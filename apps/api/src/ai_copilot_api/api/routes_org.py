from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.db.models import User
from ai_copilot_api.db.session import get_db
from ai_copilot_api.schemas.crm import UserBrief

router = APIRouter(prefix="/org", tags=["organization"])


@router.get("/users", response_model=list[UserBrief])
def list_organization_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserBrief]:
    rows = db.scalars(
        select(User)
        .where(User.organization_id == current_user.organization_id)
        .order_by(User.email),
    ).all()
    return [UserBrief.model_validate(r) for r in rows]
