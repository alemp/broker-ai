from __future__ import annotations

from ai_copilot_api.db.enums import OpportunityStage, OpportunityStatus


def status_for_stage(
    stage: OpportunityStage,
    prior_status: OpportunityStatus,
) -> OpportunityStatus:
    if stage == OpportunityStage.CLOSED_WON:
        return OpportunityStatus.WON
    if stage == OpportunityStage.CLOSED_LOST:
        return OpportunityStatus.LOST
    if stage == OpportunityStage.POST_SALE:
        return OpportunityStatus.WON
    if prior_status in (OpportunityStatus.WON, OpportunityStatus.LOST):
        return OpportunityStatus.OPEN
    return prior_status
