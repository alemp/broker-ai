from __future__ import annotations

import uuid

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ai_copilot_api.auth.jwt_tokens import decode_access_token
from ai_copilot_api.config import Settings, get_settings
from ai_copilot_api.db.enums import UserRole
from ai_copilot_api.db.models import Opportunity, User
from ai_copilot_api.db.session import get_db

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    try:
        payload = decode_access_token(settings, token)
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    sub = payload.get("sub")
    org_id = payload.get("org_id")
    if not sub or not org_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user_id = uuid.UUID(sub)
        organization_id = uuid.UUID(org_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    user = db.scalar(
        select(User).options(selectinload(User.organization)).where(User.id == user_id),
    )
    if user is None or user.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def require_broker_or_above(current_user: User = Depends(get_current_user)) -> User:
    """Broker, sales manager, or admin (Phase 4 JSON ingest and similar CRM writes)."""
    if current_user.role not in (
        UserRole.ADMIN,
        UserRole.SALES_MANAGER,
        UserRole.BROKER,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Broker or elevated role required",
        )
    return current_user


def assert_can_extract_for_opportunity(user: User, opp: Opportunity) -> None:
    """ADR-PROPOSAL-INGEST §D7 — extraction permission matrix.

    Admins and sales managers may extract for any opportunity in their org;
    brokers may only do so for opportunities they own (`owner_id == user.id`).
    """
    if user.organization_id != opp.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    if user.role in (UserRole.ADMIN, UserRole.SALES_MANAGER):
        return
    if user.role == UserRole.BROKER and opp.owner_id == user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient permissions to extract this proposal",
    )
