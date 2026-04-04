"""Keep opportunity.last_interaction_at aligned with linked interactions."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ai_copilot_api.db.models import Interaction, Opportunity


def refresh_opportunity_last_interaction_at(db: Session, opportunity_id: uuid.UUID | None) -> None:
    if opportunity_id is None:
        return
    opp = db.get(Opportunity, opportunity_id)
    if opp is None:
        return
    max_at = db.scalar(
        select(func.max(Interaction.occurred_at)).where(
            Interaction.opportunity_id == opportunity_id,
        ),
    )
    opp.last_interaction_at = max_at
