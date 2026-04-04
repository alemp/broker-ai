from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from ai_copilot_api.db.enums import (
    IngestionSource,
    OpportunityStage,
    OpportunityStatus,
    ProductCategory,
    ProductRiskLevel,
)
from ai_copilot_api.schemas.client_profile import ClientInsuranceProfile


class ClientCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=64)
    external_id: str | None = Field(default=None, max_length=128)
    notes: str | None = None


class ClientUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=64)
    external_id: str | None = Field(default=None, max_length=128)
    notes: str | None = None


class ClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    external_id: str | None
    email: str | None
    phone: str | None
    full_name: str
    notes: str | None
    created_at: datetime
    updated_at: datetime


class LineOfBusinessCreate(BaseModel):
    code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class LineOfBusinessUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class LineOfBusinessOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    code: str
    name: str
    description: str | None
    created_at: datetime


class ClientLineOfBusinessCreate(BaseModel):
    line_of_business_id: uuid.UUID
    ingestion_source: IngestionSource = IngestionSource.INTERNAL_CRM


class ClientLineOfBusinessOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    line_of_business_id: uuid.UUID
    ingestion_source: IngestionSource
    created_at: datetime
    line_of_business: LineOfBusinessOut


class ClientHeldProductCreate(BaseModel):
    product_id: uuid.UUID | None = None
    insurer_name: str | None = Field(default=None, max_length=255)
    policy_status: str | None = Field(default=None, max_length=64)
    effective_date: date | None = None
    end_date: date | None = None
    ingestion_source: IngestionSource = IngestionSource.INTERNAL_CRM
    notes: str | None = None


class ClientHeldProductUpdate(BaseModel):
    product_id: uuid.UUID | None = None
    insurer_name: str | None = Field(default=None, max_length=255)
    policy_status: str | None = Field(default=None, max_length=64)
    effective_date: date | None = None
    end_date: date | None = None
    notes: str | None = None


class ProductBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: ProductCategory


class ClientHeldProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    product_id: uuid.UUID | None
    insurer_name: str | None
    policy_status: str | None
    effective_date: date | None
    end_date: date | None
    ingestion_source: IngestionSource
    notes: str | None
    created_at: datetime
    updated_at: datetime
    product: ProductBrief | None


class ClientDetailOut(ClientOut):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    lines_of_business: list[ClientLineOfBusinessOut] = Field(
        validation_alias="line_of_business_links",
    )
    held_products: list[ClientHeldProductOut]
    profile: ClientInsuranceProfile = Field(default_factory=ClientInsuranceProfile)
    profile_completeness_score: int = Field(default=0, ge=0, le=100)
    profile_alerts: list[str] = Field(default_factory=list)


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    category: ProductCategory
    description: str | None = None
    risk_level: ProductRiskLevel
    target_tags: str | None = Field(default=None, max_length=512)
    active: bool = True


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    category: ProductCategory | None = None
    description: str | None = None
    risk_level: ProductRiskLevel | None = None
    target_tags: str | None = Field(default=None, max_length=512)
    active: bool | None = None


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    category: ProductCategory
    description: str | None
    risk_level: ProductRiskLevel
    target_tags: str | None
    active: bool
    created_at: datetime


class OpportunityCreate(BaseModel):
    client_id: uuid.UUID
    owner_id: uuid.UUID
    product_id: uuid.UUID | None = None
    estimated_value: Decimal | None = None
    closing_probability: int = Field(default=0, ge=0, le=100)
    stage: OpportunityStage = OpportunityStage.LEAD
    status: OpportunityStatus = OpportunityStatus.OPEN
    source: str | None = Field(default=None, max_length=255)
    last_interaction_at: datetime | None = None
    next_action: str | None = None


class OpportunityUpdate(BaseModel):
    owner_id: uuid.UUID | None = None
    product_id: uuid.UUID | None = None
    estimated_value: Decimal | None = None
    closing_probability: int | None = Field(default=None, ge=0, le=100)
    stage: OpportunityStage | None = None
    status: OpportunityStatus | None = None
    source: str | None = Field(default=None, max_length=255)
    last_interaction_at: datetime | None = None
    next_action: str | None = None


class OpportunityStagePatch(BaseModel):
    stage: OpportunityStage


class ClientBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str | None


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str | None


class OpportunityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    client_id: uuid.UUID
    owner_id: uuid.UUID
    product_id: uuid.UUID | None
    estimated_value: Decimal | None
    closing_probability: int
    stage: OpportunityStage
    status: OpportunityStatus
    source: str | None
    last_interaction_at: datetime | None
    next_action: str | None
    created_at: datetime
    updated_at: datetime
    client: ClientBrief
    owner: UserBrief
    product: ProductBrief | None
