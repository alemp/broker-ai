from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ai_copilot_api.schemas.crm import UserBrief


class NormalizedCoverageOut(BaseModel):
    raw: str
    code: str | None
    label: str | None
    confidence: int = Field(ge=0, le=100)
    matched_synonym: str | None


class DocumentExtractionRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_id: uuid.UUID
    confidence: int = Field(ge=0, le=100)
    requires_review: bool
    extracted_data: dict[str, Any]
    normalized_data: dict[str, Any]
    confirmed_at: datetime | None
    created_at: datetime

    created_by_user: UserBrief
    confirmed_by_user: UserBrief | None


class DocumentExtractionConfirmIn(BaseModel):
    extracted_data: dict[str, Any]
    normalized_data: dict[str, Any] = Field(default_factory=dict)

