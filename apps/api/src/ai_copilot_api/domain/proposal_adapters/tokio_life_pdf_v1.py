"""Adapter: Tokio Marine PME Vida PDF text → canonical life payload.

Reuses :func:`extract_tokio_life_pme_proposal` to build the same
``proposta_seguro_vida`` shape as the JSON channel, then
:class:`TokioLifeJsonAdapterV1` for a single normalization path.
"""

from __future__ import annotations

from typing import Any

from ai_copilot_api.db.enums import ProductCategory
from ai_copilot_api.domain.proposal_adapters.tokio_life_json_v1 import (
    TokioLifeJsonAdapterV1,
)
from ai_copilot_api.domain.proposal_pdf_life_extraction import (
    TokioLifePdfRawExtraction,
    extract_tokio_life_pme_proposal,
)


class TokioLifePdfAdapterV1:
    """Tokio Marine group-life PDF → canonical dict (``LifeProposalPayload``)."""

    source = "tokio_life_pdf_v1"
    insurance_line = ProductCategory.LIFE_INSURANCE
    last_pdf_extraction: TokioLifePdfRawExtraction | None = None

    def to_canonical_dict(self, raw: Any) -> dict[str, Any]:
        self.last_pdf_extraction = None
        if not isinstance(raw, dict):
            raise ValueError(
                "Tokio Life PDF adapter expects {'compact_text': str, 'raw_text': str}",
            )
        compact_text = str(raw.get("compact_text") or "")
        raw_text = str(raw.get("raw_text") or "")
        ext = extract_tokio_life_pme_proposal(raw_text, compact_text)
        self.last_pdf_extraction = ext
        return TokioLifeJsonAdapterV1().to_canonical_dict(
            {"proposta_seguro_vida": ext.tokio_inner},
        )


__all__ = ["TokioLifePdfAdapterV1"]
