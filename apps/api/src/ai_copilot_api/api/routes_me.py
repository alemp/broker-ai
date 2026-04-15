from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.auth import hash_password
from ai_copilot_api.db.models import User
from ai_copilot_api.db.session import get_db
from ai_copilot_api.schemas.auth import MeResponse, MeUpdateRequest, OrganizationBrief, UserMe

router = APIRouter()


def _me_response(current_user: User) -> MeResponse:
    org = current_user.organization
    return MeResponse(
        user=UserMe(
            id=current_user.id,
            email=current_user.email,
            full_name=current_user.full_name,
            role=current_user.role,
            active=current_user.active,
            organization=OrganizationBrief(
                id=org.id,
                name=org.name,
                slug=org.slug,
            ),
        ),
    )


@router.get("/me", response_model=MeResponse)
def read_me(
    current_user: User = Depends(get_current_user),
) -> MeResponse:
    return _me_response(current_user)


@router.patch("/me", response_model=MeResponse)
def update_me(
    body: MeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MeResponse:
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No fields to update",
        )

    password = data.pop("password", None)
    for k, v in data.items():
        setattr(current_user, k, v)
    if password is not None:
        current_user.password_hash = hash_password(password)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return _me_response(current_user)
