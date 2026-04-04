"""Append-only CRM audit trail (PRODUCT §5.2 — histórico de atualização)."""

from __future__ import annotations

import json
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from ai_copilot_api.db.enums import CrmAuditAction, CrmEntityType
from ai_copilot_api.db.models import CrmAuditEvent


def _fmt_audit_val(value: object | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, str | int | float | bool):
        return str(value)
    return json.dumps(value, default=str)


def record_audit(
    db: Session,
    *,
    organization_id: uuid.UUID,
    actor_user_id: uuid.UUID,
    entity_type: CrmEntityType,
    entity_id: uuid.UUID,
    action: CrmAuditAction,
    field_name: str | None = None,
    old_value: object | None = None,
    new_value: object | None = None,
) -> None:
    db.add(
        CrmAuditEvent(
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            field_name=field_name,
            old_value=_fmt_audit_val(old_value),
            new_value=_fmt_audit_val(new_value),
        )
    )


def record_entity_snapshot_create(
    db: Session,
    *,
    organization_id: uuid.UUID,
    actor_user_id: uuid.UUID,
    entity_type: CrmEntityType,
    entity_id: uuid.UUID,
    snapshot: dict[str, Any],
) -> None:
    for key, val in snapshot.items():
        if val is None:
            continue
        record_audit(
            db,
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=CrmAuditAction.CREATE,
            field_name=key,
            old_value=None,
            new_value=val,
        )


def record_field_updates(
    db: Session,
    *,
    organization_id: uuid.UUID,
    actor_user_id: uuid.UUID,
    entity_type: CrmEntityType,
    entity_id: uuid.UUID,
    before: dict[str, Any],
    updates: dict[str, Any],
) -> None:
    for key, new_val in updates.items():
        old_val = before.get(key)
        if old_val == new_val:
            continue
        record_audit(
            db,
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=CrmAuditAction.UPDATE,
            field_name=key,
            old_value=old_val,
            new_value=new_val,
        )
