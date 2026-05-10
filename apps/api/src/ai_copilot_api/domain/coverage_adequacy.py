"""Per-coverage "semáforo" for proposals (Phase 9 / coverage-level adequacy).

Builds on the existing client-level adequacy (`AdequacyTrafficLight`) by
walking the **expected** coverage set declared on the linked
:class:`ai_copilot_api.db.models.Product` and matching it against the
**actual** ``proposal_data.clauses[]`` persisted onto the opportunity.

Matching strategy (deterministic):

1. **Exact code match** between the product's ``additional_coverages[*].code``
   and ``clauses[*].code`` → ``GREEN``.
2. **Taxonomy synonym match** between the product's expected coverage label
   and the clause description, via
   :func:`ai_copilot_api.domain.coverage_normalization.normalize_coverages`.
   Strong matches (confidence ≥ 70) → ``GREEN``;
   moderate matches (40 ≤ confidence < 70) → ``YELLOW``.
3. **No match** → ``RED``.

The function is **pure** (no DB writes) — callers feed in the already-loaded
taxonomy + opportunity row and receive the per-coverage assessment.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ai_copilot_api.db.enums import AdequacyTrafficLight
from ai_copilot_api.db.models import Opportunity, Product
from ai_copilot_api.domain.coverage_normalization import normalize_coverages

STRONG_MATCH_THRESHOLD = 70
MODERATE_MATCH_THRESHOLD = 40


@dataclass(frozen=True)
class CoverageAdequacyItem:
    """Per-coverage assessment of a single expected coverage code."""

    code: str
    label: str
    status: AdequacyTrafficLight
    matched_clause_code: str | None
    matched_clause_description: str | None
    match_confidence: int  # 0..100
    reason: str


def _coerce_coverage_dicts(raw: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not isinstance(raw, list):
        return out
    for item in raw:
        if isinstance(item, dict):
            out.append(item)
    return out


def _expected_from_product(product: Product | None) -> list[dict[str, str]]:
    """Coerce ``Product.additional_coverages`` JSONB into typed ``[{code,label}]``.

    Items missing a ``code`` are dropped (the resolver keys on code).
    """
    items: list[dict[str, str]] = []
    if product is None:
        return items
    raw = product.additional_coverages or []
    for entry in _coerce_coverage_dicts(raw):
        code = str(entry.get("code") or "").strip()
        if not code:
            continue
        label = str(entry.get("label") or entry.get("description") or code).strip() or code
        items.append({"code": code, "label": label})
    return items


def _clauses_from_proposal(proposal_data: Any) -> list[dict[str, str]]:
    """Coerce ``Opportunity.proposal_data.clauses[]`` into typed ``[{code,description}]``."""
    if not isinstance(proposal_data, dict):
        return []
    raw = proposal_data.get("clauses") or []
    out: list[dict[str, str]] = []
    for entry in _coerce_coverage_dicts(raw):
        code = str(entry.get("code") or "").strip()
        description = str(entry.get("description") or entry.get("label") or "").strip()
        if not code and not description:
            continue
        out.append({"code": code, "description": description})
    return out


def _coverage_taxonomy_for_codes(
    taxonomy: list[dict[str, Any]],
    expected_codes: set[str],
) -> list[dict[str, Any]]:
    """Restrict the taxonomy used by :func:`normalize_coverages` to expected codes."""
    if not expected_codes:
        return []
    return [
        item
        for item in taxonomy
        if str(item.get("code") or "").strip() in expected_codes
    ]


def assess_coverage_adequacy(
    *,
    opportunity: Opportunity,
    product: Product | None,
    taxonomy: list[dict[str, Any]],
) -> list[CoverageAdequacyItem]:
    """Return one :class:`CoverageAdequacyItem` per expected coverage of ``product``.

    When ``product`` has no ``additional_coverages`` (or is ``None``) we return
    an empty list — there is no "expected set" to compare against. Callers
    can fall back to the product-line baseline if they want broader coverage
    in the future.
    """
    expected = _expected_from_product(product)
    if not expected:
        return []

    clauses = _clauses_from_proposal(opportunity.proposal_data)
    clauses_by_code: dict[str, dict[str, str]] = {
        c["code"]: c for c in clauses if c.get("code")
    }
    descriptions = [c["description"] for c in clauses if c.get("description")]

    expected_codes = {item["code"] for item in expected}
    scoped_taxonomy = _coverage_taxonomy_for_codes(taxonomy, expected_codes)

    # Pre-compute synonym matches once per description to avoid O(n*m) work.
    normalized = normalize_coverages(descriptions, taxonomy=scoped_taxonomy)
    best_by_code: dict[str, tuple[int, str, str]] = {}
    for n, raw in zip(normalized, descriptions, strict=True):
        if n.code is None:
            continue
        prev = best_by_code.get(n.code)
        if prev is None or n.confidence > prev[0]:
            best_by_code[n.code] = (n.confidence, raw, n.matched_synonym or "")

    out: list[CoverageAdequacyItem] = []
    for entry in expected:
        code = entry["code"]
        label = entry["label"]
        clause = clauses_by_code.get(code)
        if clause is not None:
            out.append(
                CoverageAdequacyItem(
                    code=code,
                    label=label,
                    status=AdequacyTrafficLight.GREEN,
                    matched_clause_code=code,
                    matched_clause_description=clause.get("description") or None,
                    match_confidence=100,
                    reason="exact_code_match",
                ),
            )
            continue

        synonym = best_by_code.get(code)
        if synonym is not None:
            confidence, raw_desc, _matched_syn = synonym
            if confidence >= STRONG_MATCH_THRESHOLD:
                status = AdequacyTrafficLight.GREEN
                reason = "synonym_match_strong"
            elif confidence >= MODERATE_MATCH_THRESHOLD:
                status = AdequacyTrafficLight.YELLOW
                reason = "synonym_match_moderate"
            else:
                status = AdequacyTrafficLight.RED
                reason = "synonym_match_weak"
            out.append(
                CoverageAdequacyItem(
                    code=code,
                    label=label,
                    status=status,
                    matched_clause_code=None,
                    matched_clause_description=raw_desc,
                    match_confidence=confidence,
                    reason=reason,
                ),
            )
            continue

        out.append(
            CoverageAdequacyItem(
                code=code,
                label=label,
                status=AdequacyTrafficLight.RED,
                matched_clause_code=None,
                matched_clause_description=None,
                match_confidence=0,
                reason="missing",
            ),
        )
    return out


__all__ = [
    "MODERATE_MATCH_THRESHOLD",
    "STRONG_MATCH_THRESHOLD",
    "CoverageAdequacyItem",
    "assess_coverage_adequacy",
]
