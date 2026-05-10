"""Proposal source adapters.

Each adapter normalizes a carrier-specific or channel-specific shape into the
canonical English schema (`schemas.proposal_ingest.AutoProposalPayload` for the
`AUTO_INSURANCE` line). The `ProposalSourceAdapter` protocol keeps the API
layer free of carrier branches: routes select an adapter by `source` /
`(insurance_line, format)` and call `to_canonical_dict(...)`.

Adapters return **dicts** (not Pydantic models). Validation happens once, at
the boundary, by feeding the dict into the matching canonical payload class
returned by :func:`schemas.proposal_ingest.select_proposal_payload_class`,
so the same error path is exercised by both JSON and PDF channels.

Phase 9 — multi-line:

- ``select_adapter_for_pdf`` / ``select_adapter_for_json`` now know about
  ``LIFE_INSURANCE`` and ``GENERAL_INSURANCE`` and surface clean
  ``NotImplementedError`` messages until a carrier adapter ships.
- Canonical pass-through JSON adapters exist for every supported line
  (``canonical_auto_v1``, ``canonical_life_v1``, ``canonical_home_v1``,
  ``canonical_business_v1``) so partners can already submit pre-canonical
  payloads through the JSON channel.
"""

from __future__ import annotations

from typing import Any, Protocol

from ai_copilot_api.db.enums import ProductCategory


class ProposalSourceAdapter(Protocol):
    """Normalize a raw carrier/channel input into a canonical-shaped dict."""

    source: str  # short stable id, e.g. "bradesco_json_v1" / "bradesco_pdf_v1"
    insurance_line: ProductCategory

    def to_canonical_dict(self, raw: Any) -> dict[str, Any]:  # noqa: D401
        """Return a dict that validates against the canonical payload."""
        ...


def select_adapter_for_pdf(insurance_line: ProductCategory) -> ProposalSourceAdapter:
    """Pick the default PDF adapter for a given line.

    Only ``AUTO_INSURANCE`` has a working PDF extractor today (Phase 2 —
    Bradesco). All other lines raise a clean :class:`NotImplementedError`
    so the caller can surface a 422 instead of a 500.
    """
    from ai_copilot_api.domain.proposal_adapters.bradesco_pdf_v1 import (
        BradescoAutoPdfAdapterV1,
    )

    if insurance_line == ProductCategory.AUTO_INSURANCE:
        return BradescoAutoPdfAdapterV1()
    if insurance_line in (
        ProductCategory.LIFE_INSURANCE,
        ProductCategory.HEALTH_INSURANCE,
        ProductCategory.GENERAL_INSURANCE,
    ):
        raise NotImplementedError(
            f"No PDF proposal adapter is wired for insurance_line={insurance_line.value}; "
            "use the JSON channel with a canonical_* source until a carrier adapter ships.",
        )
    raise NotImplementedError(
        f"Unknown insurance_line for PDF adapter selection: {insurance_line!r}",
    )


class _CanonicalPassthroughAdapter:
    """Generic pass-through for payloads already in canonical shape (English keys).

    Subclasses set the public ``source`` and ``insurance_line`` attributes;
    validation happens at the route layer via the matching canonical
    Pydantic class returned by ``select_proposal_payload_class``.
    """

    source: str
    insurance_line: ProductCategory

    def to_canonical_dict(self, raw: Any) -> dict[str, Any]:
        if not isinstance(raw, dict):
            raise TypeError(f"{self.source} expects a JSON object at the root")
        return dict(raw)


class _CanonicalAutoJsonAdapter(_CanonicalPassthroughAdapter):
    source = "canonical_auto_v1"
    insurance_line = ProductCategory.AUTO_INSURANCE


class _CanonicalLifeJsonAdapter(_CanonicalPassthroughAdapter):
    source = "canonical_life_v1"
    insurance_line = ProductCategory.LIFE_INSURANCE


class _CanonicalHomeJsonAdapter(_CanonicalPassthroughAdapter):
    source = "canonical_home_v1"
    insurance_line = ProductCategory.GENERAL_INSURANCE


class _CanonicalBusinessJsonAdapter(_CanonicalPassthroughAdapter):
    source = "canonical_business_v1"
    insurance_line = ProductCategory.GENERAL_INSURANCE


def select_adapter_for_json(source: str) -> ProposalSourceAdapter:
    """Pick a JSON adapter by stable ``source`` id (used by the Phase 4 channel)."""
    from ai_copilot_api.domain.proposal_adapters.bradesco_json_v1 import (
        BradescoAutoJsonAdapterV1,
    )
    from ai_copilot_api.domain.proposal_adapters.tokio_life_json_v1 import (
        TokioLifeJsonAdapterV1,
    )

    key = (source or "").strip().lower()
    if key in ("bradesco_json_v1", "bradesco_v1"):
        return BradescoAutoJsonAdapterV1()
    if key in ("tokio_life_json_v1", "tokio_life_v1"):
        return TokioLifeJsonAdapterV1()
    if key == "canonical_auto_v1":
        return _CanonicalAutoJsonAdapter()
    if key == "canonical_life_v1":
        return _CanonicalLifeJsonAdapter()
    if key == "canonical_home_v1":
        return _CanonicalHomeJsonAdapter()
    if key == "canonical_business_v1":
        return _CanonicalBusinessJsonAdapter()
    raise NotImplementedError(f"Unknown proposal JSON source: {source!r}")
