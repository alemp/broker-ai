from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ai_copilot_api.auth import create_access_token, hash_password, verify_password
from ai_copilot_api.config import Settings, get_settings
from ai_copilot_api.db.enums import UserRole
from ai_copilot_api.db.models import Organization, User
from ai_copilot_api.db.session import get_db
from ai_copilot_api.schemas.auth import LoginRequest, RegisterRequest, TokenResponse

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
def register(
    body: RegisterRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    slug = settings.default_organization_slug
    org = db.scalar(select(Organization).where(Organization.slug == slug))
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Default organization is not configured",
        )
    existing = db.scalar(select(User).where(User.email == body.email))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = User(
        organization_id=org.id,
        email=str(body.email).lower(),
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role=UserRole.ADMIN,
        active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token, expires_in = create_access_token(
        settings,
        user_id=user.id,
        organization_id=user.organization_id,
        email=user.email,
    )
    return TokenResponse(access_token=token, expires_in=expires_in)


@router.post("/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == str(body.email).lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    token, expires_in = create_access_token(
        settings,
        user_id=user.id,
        organization_id=user.organization_id,
        email=user.email,
    )
    return TokenResponse(access_token=token, expires_in=expires_in)
