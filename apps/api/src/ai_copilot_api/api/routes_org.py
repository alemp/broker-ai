from __future__ import annotations

import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ai_copilot_api.api.deps import get_current_user, require_admin
from ai_copilot_api.auth import hash_password
from ai_copilot_api.db.enums import UserRole
from ai_copilot_api.db.models import Organization, User
from ai_copilot_api.db.session import get_db
from ai_copilot_api.schemas.crm import (
    OrganizationAdminOut,
    OrganizationAdminUpdate,
    OrgUserAdminCreate,
    OrgUserAdminCreatedOut,
    OrgUserAdminOut,
    OrgUserAdminUpdate,
    UserBrief,
)

router = APIRouter(prefix="/org", tags=["organization"])


def _org_user_or_404(db: Session, org_id: uuid.UUID, user_id: uuid.UUID) -> User:
    row = db.scalar(select(User).where(User.id == user_id, User.organization_id == org_id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return row


def _active_admin_count(db: Session, org_id: uuid.UUID) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(User)
            .where(
                User.organization_id == org_id,
                User.active.is_(True),
                User.role == UserRole.ADMIN,
            ),
        )
        or 0
    )


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


@router.get("/admin", response_model=OrganizationAdminOut)
def admin_get_organization(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> OrganizationAdminOut:
    org = db.scalar(select(Organization).where(Organization.id == admin_user.organization_id))
    assert org is not None  # org is enforced by foreign key
    return OrganizationAdminOut.model_validate(org)


@router.patch("/admin", response_model=OrganizationAdminOut)
def admin_update_organization(
    body: OrganizationAdminUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> OrganizationAdminOut:
    org = db.scalar(select(Organization).where(Organization.id == admin_user.organization_id))
    assert org is not None  # org is enforced by foreign key
    org.name = body.name.strip()
    db.commit()
    db.refresh(org)
    return OrganizationAdminOut.model_validate(org)


@router.get("/admin/users", response_model=list[OrgUserAdminOut])
def admin_list_users(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> list[OrgUserAdminOut]:
    rows = db.scalars(
        select(User)
        .where(User.organization_id == admin_user.organization_id)
        .order_by(User.email),
    ).all()
    return [OrgUserAdminOut.model_validate(r) for r in rows]


@router.post(
    "/admin/users",
    response_model=OrgUserAdminCreatedOut,
    status_code=status.HTTP_201_CREATED,
)
def admin_create_user(
    body: OrgUserAdminCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> OrgUserAdminCreatedOut:
    email_norm = str(body.email).lower().strip()
    existing = db.scalar(select(User).where(User.email == email_norm))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    temp_password: str | None = None
    password = body.password
    if password is None:
        temp_password = secrets.token_urlsafe(18)
        password = temp_password

    row = User(
        organization_id=admin_user.organization_id,
        email=email_norm,
        full_name=body.full_name,
        role=body.role,
        active=body.active,
        password_hash=hash_password(password),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return OrgUserAdminCreatedOut(
        user=OrgUserAdminOut.model_validate(row),
        temporary_password=temp_password,
    )


@router.patch("/admin/users/{user_id}", response_model=OrgUserAdminOut)
def admin_update_user(
    user_id: uuid.UUID,
    body: OrgUserAdminUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> OrgUserAdminOut:
    row = _org_user_or_404(db, admin_user.organization_id, user_id)

    prior_role = row.role
    prior_active = row.active
    data = body.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    for k, v in data.items():
        setattr(row, k, v)
    if password is not None:
        row.password_hash = hash_password(password)

    # Guardrail: never allow the org to end up with zero active admins.
    demoting_admin = prior_role == UserRole.ADMIN and row.role != UserRole.ADMIN
    deactivating_admin = (
        prior_role == UserRole.ADMIN and prior_active is True and row.active is False
    )
    if demoting_admin or deactivating_admin:
        remaining = int(
            db.scalar(
                select(func.count())
                .select_from(User)
                .where(
                    User.organization_id == admin_user.organization_id,
                    User.active.is_(True),
                    User.role == UserRole.ADMIN,
                    User.id != row.id,
                ),
            )
            or 0
        )
        if remaining == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Organization must have at least one active ADMIN user",
            )
    db.commit()
    db.refresh(row)
    return OrgUserAdminOut.model_validate(row)


@router.post("/admin/users/{user_id}/reset-password", response_model=OrgUserAdminCreatedOut)
def admin_reset_password(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> OrgUserAdminCreatedOut:
    row = _org_user_or_404(db, admin_user.organization_id, user_id)
    temp_password = secrets.token_urlsafe(18)
    row.password_hash = hash_password(temp_password)
    db.commit()
    db.refresh(row)
    return OrgUserAdminCreatedOut(
        user=OrgUserAdminOut.model_validate(row),
        temporary_password=temp_password,
    )
