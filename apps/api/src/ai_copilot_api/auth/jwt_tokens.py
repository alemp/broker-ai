from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt

from ai_copilot_api.config import Settings


def create_access_token(
    settings: Settings,
    *,
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    email: str,
) -> tuple[str, int]:
    expire_hours = settings.jwt_expire_hours
    now = datetime.now(tz=UTC)
    exp = now + timedelta(hours=expire_hours)
    payload = {
        "sub": str(user_id),
        "org_id": str(organization_id),
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    token = jwt.encode(
        payload,
        settings.jwt_secret,
        algorithm="HS256",
    )
    return token, expire_hours * 3600


def decode_access_token(settings: Settings, token: str) -> dict[str, str]:
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=["HS256"],
    )
