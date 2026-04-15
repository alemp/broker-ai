from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class CoverageTaxonomyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    label: str
    synonyms: list[Any]
    active: bool
    created_at: datetime


class CoverageTaxonomyCreate(BaseModel):
    code: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=255)
    synonyms: list[str] = Field(default_factory=list)
    active: bool = True


class CoverageTaxonomyUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=255)
    synonyms: list[str] | None = None
    active: bool | None = None

