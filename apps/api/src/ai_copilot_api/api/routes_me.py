from fastapi import APIRouter, Depends

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.db.models import User
from ai_copilot_api.schemas.auth import MeResponse, OrganizationBrief, UserMe

router = APIRouter()


@router.get("/me", response_model=MeResponse)
def read_me(
    current_user: User = Depends(get_current_user),
) -> MeResponse:
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
