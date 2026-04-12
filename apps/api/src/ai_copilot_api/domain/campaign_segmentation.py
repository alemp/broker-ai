"""Campaign audience selection (PRODUCT.md §5.9) — MVP segment criteria on JSONB."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ai_copilot_api.db.enums import AdequacyTrafficLight, ProductCategory
from ai_copilot_api.db.models import Client, ClientHeldProduct
from ai_copilot_api.domain.adequacy_batch import traffic_light_for_segmentation


def _truthy_segment_flag(raw: dict[str, Any], key: str) -> bool | None:
    if key not in raw:
        return None
    v = raw[key]
    if isinstance(v, bool):
        return v
    return None


def _min_completeness(raw: dict[str, Any]) -> int | None:
    v = raw.get("min_profile_completeness")
    if isinstance(v, int) and 0 <= v <= 100:
        return v
    return None


def _missing_category(raw: dict[str, Any]) -> ProductCategory | None:
    v = raw.get("missing_product_category")
    if v is None:
        return None
    if isinstance(v, str):
        try:
            return ProductCategory(v)
        except ValueError:
            return None
    return None


def _max_traffic_light(raw: dict[str, Any]) -> AdequacyTrafficLight | None:
    """If set, only clients at least this 'severe' (RED > YELLOW > GREEN)."""
    v = raw.get("max_adequacy_traffic_light")
    if v is None:
        return None
    if isinstance(v, str):
        try:
            return AdequacyTrafficLight(v)
        except ValueError:
            return None
    return None


def _severity(light: AdequacyTrafficLight) -> int:
    return {
        AdequacyTrafficLight.GREEN: 0,
        AdequacyTrafficLight.YELLOW: 1,
        AdequacyTrafficLight.RED: 2,
    }[light]


def _client_missing_category(client: Client, cat: ProductCategory) -> bool:
    from ai_copilot_api.domain.recommendation_rules import _has_active_category

    return not _has_active_category(client, cat)


def clients_matching_segment_criteria(
    db: Session,
    organization_id: uuid.UUID,
    criteria: dict[str, Any],
) -> list[Client]:
    """
    Return clients in org matching all applicable criteria.

    Supported keys in ``segment_criteria``:
    - ``marketing_opt_in`` (bool): filter by consent flag.
    - ``min_profile_completeness`` (int 0–100): parse profile and score.
    - ``missing_product_category``: enum name, e.g. ``LIFE_INSURANCE``.
    - ``max_adequacy_traffic_light``: ``GREEN`` | ``YELLOW`` | ``RED`` —
      client must be at least as severe (e.g. YELLOW includes YELLOW and RED).
    """
    stmt = (
        select(Client)
        .options(
            selectinload(Client.held_products).selectinload(ClientHeldProduct.product),
        )
        .where(Client.organization_id == organization_id)
    )
    rows = list(db.scalars(stmt).unique().all())

    m_opt = _truthy_segment_flag(criteria, "marketing_opt_in")
    min_score = _min_completeness(criteria)
    miss_cat = _missing_category(criteria)
    max_light = _max_traffic_light(criteria)

    out: list[Client] = []
    for c in rows:
        if m_opt is not None and c.marketing_opt_in != m_opt:
            continue
        if min_score is not None:
            from ai_copilot_api.domain.client_profile import completeness_score, parse_profile

            sc = completeness_score(
                parse_profile(c.profile_data if isinstance(c.profile_data, dict) else None)
            )
            if sc < min_score:
                continue
        if miss_cat is not None and not _client_missing_category(c, miss_cat):
            continue
        if max_light is not None:
            light = traffic_light_for_segmentation(db, c)
            if _severity(light) < _severity(max_light):
                continue
        out.append(c)
    return out
