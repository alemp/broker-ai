"""Business rules for opportunities (PRODUCT.md §5.4)."""

from __future__ import annotations

from fastapi import HTTPException, status

from ai_copilot_api.db.enums import OpportunityStage, OpportunityStatus
from ai_copilot_api.db.models import Opportunity

# Open pipeline stages where the brief requires a defined next action (§5.4 item 7).
_STAGES_REQUIRING_NEXT_ACTION: frozenset[OpportunityStage] = frozenset(
    {
        OpportunityStage.QUALIFIED,
        OpportunityStage.PROPOSAL_SENT,
        OpportunityStage.NEGOTIATION,
    },
)


def assert_next_action_when_required(row: Opportunity) -> None:
    if row.status != OpportunityStatus.OPEN:
        return
    if row.stage not in _STAGES_REQUIRING_NEXT_ACTION:
        return
    text = (row.next_action or "").strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Next action is required for opportunities in this pipeline stage",
        )


def assert_post_sale_only_after_win(
    prior_stage: OpportunityStage,
    prior_status: OpportunityStatus,
) -> None:
    """POST_SALE (§5.4) follows a won close."""
    if prior_stage != OpportunityStage.CLOSED_WON or prior_status != OpportunityStatus.WON:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Post-sale stage is only available after the opportunity is won",
        )
