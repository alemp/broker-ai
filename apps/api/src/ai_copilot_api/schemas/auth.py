from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from ai_copilot_api.db.enums import UserRole


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)
    full_name: str | None = Field(default=None, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class OrganizationBrief(BaseModel):
    id: UUID
    name: str
    slug: str


class UserMe(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str | None
    role: UserRole
    active: bool
    organization: OrganizationBrief


class MeResponse(BaseModel):
    user: UserMe


class MeUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=256)
