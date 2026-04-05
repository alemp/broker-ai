"""Read-only catalog of built-in recommendation rules (Phase 6 explainability)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ai_copilot_api.api.deps import get_current_user
from ai_copilot_api.db.models import User
from ai_copilot_api.domain.recommendation_rules import list_builtin_recommendation_rules
from ai_copilot_api.schemas.crm import RecommendationBuiltinRuleOut

router = APIRouter(prefix="/recommendation-rules", tags=["intel"])


@router.get("", response_model=list[RecommendationBuiltinRuleOut])
def list_recommendation_rules_catalog(
    _current_user: User = Depends(get_current_user),
) -> list[RecommendationBuiltinRuleOut]:
    """Documented rule IDs evaluated by `evaluate_rules_for_client` (no `eval`; code-defined)."""
    return [
        RecommendationBuiltinRuleOut(
            rule_id=r.rule_id,
            title=r.title,
            description=r.description,
            inputs=list(r.inputs),
        )
        for r in list_builtin_recommendation_rules()
    ]
