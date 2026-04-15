from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from ai_copilot_api.db.enums import DocumentType
from ai_copilot_api.schemas.crm import UserBrief


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_type: DocumentType
    original_filename: str
    content_type: str
    size_bytes: int
    sha256: str
    storage_key: str
    product_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    current_version: int

    uploaded_by_user: UserBrief


class DocumentVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_id: uuid.UUID
    version: int
    content_type: str
    size_bytes: int
    sha256: str
    storage_key: str
    created_at: datetime

    uploaded_by_user: UserBrief

