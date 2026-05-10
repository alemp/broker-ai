"""Adapter: Bradesco Auto PDF text → canonical schema.

The PDF channel reuses the carrier's pt-BR JSON shape as an intermediate
representation: `extract_auto_proposal` produces it from the document text
and `BradescoAutoJsonAdapterV1` projects it into the canonical English
`AutoProposalPayload`. This keeps a single normalization code path between
the JSON and PDF channels.
"""

from __future__ import annotations

from typing import Any

from ai_copilot_api.db.enums import ProductCategory
from ai_copilot_api.domain.proposal_adapters.bradesco_json_v1 import (
    BradescoAutoJsonAdapterV1,
)
from ai_copilot_api.domain.proposal_pdf_extraction import extract_auto_proposal


class BradescoAutoPdfAdapterV1:
    """Bradesco Auto PDF text (compact + raw) → canonical dict."""

    source = "bradesco_pdf_v1"
    insurance_line = ProductCategory.AUTO_INSURANCE

    def to_canonical_dict(self, raw: Any) -> dict[str, Any]:
        if not isinstance(raw, dict):
            raise ValueError(
                "Bradesco PDF adapter expects {'compact_text': str, 'raw_text': str}",
            )
        compact_text = str(raw.get("compact_text") or "")
        raw_text = str(raw.get("raw_text") or "")
        extraction = extract_auto_proposal(compact_text, raw_text)
        return BradescoAutoJsonAdapterV1().to_canonical_dict(extraction.raw)
