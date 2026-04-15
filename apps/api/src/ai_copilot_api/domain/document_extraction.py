from __future__ import annotations

import re
from dataclasses import dataclass

import httpx
import pytesseract
from pdf2image import convert_from_bytes
from pypdf import PdfReader

from ai_copilot_api.db.enums import DocumentType


@dataclass(frozen=True)
class ExtractionResult:
    extracted_data: dict[str, object]
    confidence: int  # 0..100
    requires_review: bool


def extract_pdf_text(pdf_bytes: bytes) -> str:
    reader = PdfReader(_as_bytes_io(pdf_bytes))
    parts: list[str] = []
    for page in reader.pages:
        txt = page.extract_text() or ""
        if txt.strip():
            parts.append(txt)
    return "\n".join(parts)


def extract_pdf_text_with_ocr(
    pdf_bytes: bytes,
    *,
    ocr_enabled: bool,
    min_text_chars: int,
    language: str,
    provider_url: str | None = None,
    provider_timeout_seconds: int = 60,
    provider_max_pages: int = 25,
    provider_dpi: int = 200,
) -> tuple[str, dict[str, object]]:
    """
    Best-effort PDF text extraction with PyPDF-first strategy.

    Returns (text, meta) where meta describes how extraction happened.
    """
    pypdf_text = extract_pdf_text(pdf_bytes)
    if not ocr_enabled:
        return pypdf_text, {"method": "pypdf", "ocr_used": False, "text_chars": len(pypdf_text)}

    if len(pypdf_text.strip()) >= min_text_chars:
        return pypdf_text, {
            "method": "pypdf",
            "ocr_used": False,
            "text_chars": len(pypdf_text),
        }

    # OCR fallback: provider if configured, otherwise local OCR.
    if provider_url:
        try:
            timeout = httpx.Timeout(
                float(provider_timeout_seconds),
                connect=5.0,
            )
            with httpx.Client(timeout=timeout) as client:
                files = {"file": ("document.pdf", pdf_bytes, "application/pdf")}
                data = {
                    "language": language,
                    "max_pages": str(provider_max_pages),
                    "dpi": str(provider_dpi),
                }
                res = client.post(provider_url, files=files, data=data)
                res.raise_for_status()
                payload = res.json()
                out_text = payload.get("text")
                if isinstance(out_text, str):
                    if len(out_text.strip()) < min_text_chars and len(pypdf_text.strip()) > len(
                        out_text.strip(),
                    ):
                        return pypdf_text, {
                            "method": "pypdf_after_provider_short_text",
                            "ocr_used": True,
                            "provider_url": provider_url,
                            "text_chars": len(pypdf_text),
                            "language": language,
                        }
                    return out_text, {
                        "method": "provider",
                        "ocr_used": True,
                        "provider_url": provider_url,
                        "text_chars": len(out_text),
                        "language": language,
                    }
        except Exception as e:
            return pypdf_text, {
                "method": "pypdf_provider_failed",
                "ocr_used": True,
                "provider_url": provider_url,
                "provider_error": str(e)[:500],
                "text_chars": len(pypdf_text),
                "language": language,
            }

    # OCR fallback: render pages to images and run local tesseract.
    images = convert_from_bytes(pdf_bytes, dpi=220)
    ocr_parts: list[str] = []
    for img in images:
        ocr_parts.append(pytesseract.image_to_string(img, lang=language) or "")
    ocr_text = "\n".join(p for p in ocr_parts if p.strip())
    if len(ocr_text.strip()) < min_text_chars and len(pypdf_text.strip()) > len(ocr_text.strip()):
        return pypdf_text, {
            "method": "pypdf_after_ocr_short_text",
            "ocr_used": True,
            "text_chars": len(pypdf_text),
            "language": language,
        }
    return ocr_text, {
        "method": "ocr",
        "ocr_used": True,
        "text_chars": len(ocr_text),
        "pages": len(images),
        "language": language,
    }


def _as_bytes_io(data: bytes):
    from io import BytesIO

    return BytesIO(data)


def extract_structured(document_type: DocumentType, pdf_bytes: bytes) -> ExtractionResult:
    """
    Minimal, deterministic extraction:
    - Extract raw text from PDF
    - Heuristic parsing into a structured shape that can be manually corrected
    """
    # Note: OCR fallback is wired at the route layer (Settings-driven).
    text = extract_pdf_text(pdf_bytes)
    compact = _compact_text(text)

    if document_type == DocumentType.GENERAL_CONDITIONS:
        return _extract_general_conditions(compact)
    if document_type == DocumentType.POLICY:
        return _extract_policy(compact)
    # PROPOSAL / ENDORSEMENT: keep minimal fields for now
    return ExtractionResult(
        extracted_data={
            "document_type": document_type.value,
            "raw_text": _truncate(compact, 20000),
            "coverages": [],
            "exclusions": [],
        },
        confidence=10,
        requires_review=True,
    )


def extract_structured_with_text(
    document_type: DocumentType,
    *,
    compact_text: str,
    raw_text: str,
    extraction_meta: dict[str, object] | None = None,
) -> ExtractionResult:
    if document_type == DocumentType.GENERAL_CONDITIONS:
        out = _extract_general_conditions(compact_text)
    elif document_type == DocumentType.POLICY:
        out = _extract_policy(compact_text)
    elif document_type == DocumentType.PROPOSAL:
        out = _extract_proposal(compact_text)
    elif document_type == DocumentType.ENDORSEMENT:
        out = _extract_endorsement(compact_text)
    else:
        out = ExtractionResult(
            extracted_data={
                "document_type": document_type.value,
                "coverages": [],
                "exclusions": [],
                "raw_text": _truncate(compact_text, 20000),
            },
            confidence=10,
            requires_review=True,
        )

    # Ensure we always include raw_text + meta for debugging.
    extracted = dict(out.extracted_data)
    extracted.setdefault("raw_text", _truncate(raw_text, 20000))
    if extraction_meta is not None:
        extracted["extraction_meta"] = extraction_meta
    return ExtractionResult(
        extracted_data=extracted,
        confidence=out.confidence,
        requires_review=out.requires_review,
    )


def _extract_general_conditions(text: str) -> ExtractionResult:
    coverages = _find_section_lines(text, headings=("coberturas", "cobertura"), max_items=50)
    exclusions = _find_section_lines(text, headings=("exclus", "riscos exclu"), max_items=50)
    product_name = _guess_product_name(text)

    confidence = 30
    if product_name:
        confidence += 20
    if coverages:
        confidence += 40
    if exclusions:
        confidence += 10
    confidence = min(confidence, 100)

    return ExtractionResult(
        extracted_data={
            "document_type": DocumentType.GENERAL_CONDITIONS.value,
            "product_name": product_name,
            "coverages": coverages,
            "exclusions": exclusions,
            "raw_text": _truncate(text, 20000),
        },
        confidence=confidence,
        requires_review=confidence < 70,
    )


def _extract_policy(text: str) -> ExtractionResult:
    policy_number = _first_match(text, r"\bap[oó]lice\s*(n[ºo]\s*)?[:\-]?\s*([A-Z0-9\-\/\.]{6,})")
    insured_name = _first_match(text, r"\bsegurado\s*[:\-]\s*([^\n]{3,120})")

    confidence = 20
    if policy_number:
        confidence += 40
    if insured_name:
        confidence += 20
    confidence = min(confidence, 100)

    return ExtractionResult(
        extracted_data={
            "document_type": DocumentType.POLICY.value,
            "policy_number": policy_number,
            "insured_name": insured_name,
            "raw_text": _truncate(text, 20000),
        },
        confidence=confidence,
        requires_review=confidence < 70,
    )


def _extract_proposal(text: str) -> ExtractionResult:
    proposal_number = _first_match(
        text,
        r"\bproposta\s*(n[ºo]\s*)?[:\-]?\s*([A-Z0-9\-\/\.]{6,})",
    )
    insured_name = _first_match(text, r"\bproponente\s*[:\-]\s*([^\n]{3,120})") or _first_match(
        text,
        r"\bsegurado\s*[:\-]\s*([^\n]{3,120})",
    )
    product_name = _guess_product_name(text)
    coverages = _find_section_lines(text, headings=("coberturas", "cobertura"), max_items=50)

    confidence = 20
    if proposal_number:
        confidence += 30
    if insured_name:
        confidence += 20
    if product_name:
        confidence += 10
    if coverages:
        confidence += 20
    confidence = min(confidence, 100)

    return ExtractionResult(
        extracted_data={
            "document_type": DocumentType.PROPOSAL.value,
            "proposal_number": proposal_number,
            "insured_name": insured_name,
            "product_name": product_name,
            "coverages": coverages,
            "raw_text": _truncate(text, 20000),
        },
        confidence=confidence,
        requires_review=confidence < 70,
    )


def _extract_endorsement(text: str) -> ExtractionResult:
    endorsement_number = _first_match(
        text,
        r"\bendosso\s*(n[ºo]\s*)?[:\-]?\s*([A-Z0-9\-\/\.]{4,})",
    )
    policy_number = _first_match(text, r"\bap[oó]lice\s*(n[ºo]\s*)?[:\-]?\s*([A-Z0-9\-\/\.]{6,})")
    insured_name = _first_match(text, r"\bsegurado\s*[:\-]\s*([^\n]{3,120})")
    changes = _find_section_lines(
        text,
        headings=("alter", "inclus", "exclus", "substitu"),
        max_items=80,
    )

    confidence = 20
    if endorsement_number:
        confidence += 30
    if policy_number:
        confidence += 20
    if insured_name:
        confidence += 10
    if changes:
        confidence += 20
    confidence = min(confidence, 100)

    return ExtractionResult(
        extracted_data={
            "document_type": DocumentType.ENDORSEMENT.value,
            "endorsement_number": endorsement_number,
            "policy_number": policy_number,
            "insured_name": insured_name,
            "changes": changes,
            "raw_text": _truncate(text, 20000),
        },
        confidence=confidence,
        requires_review=confidence < 70,
    )


def _compact_text(text: str) -> str:
    # Normalize line endings and collapse excessive whitespace, keeping line breaks.
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _truncate(text: str, max_len: int) -> str:
    if len(text) <= max_len:
        return text
    return text[: max_len - 1] + "…"


def _guess_product_name(text: str) -> str | None:
    # Heuristics: look for "Produto:" / "Plano:" / uppercase title near beginning.
    for pat in (
        r"\bproduto\s*[:\-]\s*([^\n]{3,120})",
        r"\bplano\s*[:\-]\s*([^\n]{3,120})",
        r"\bseguro\s*[:\-]\s*([^\n]{3,120})",
    ):
        m = re.search(pat, text, flags=re.IGNORECASE)
        if m:
            return m.group(1).strip()
    head = "\n".join(text.splitlines()[:25])
    m2 = re.search(r"^[A-Z0-9][A-Z0-9 \-]{12,}$", head, flags=re.MULTILINE)
    if m2:
        return m2.group(0).strip()
    return None


def _find_section_lines(text: str, *, headings: tuple[str, ...], max_items: int) -> list[str]:
    lines = [ln.strip(" •\t-") for ln in text.splitlines()]
    lines = [ln for ln in lines if ln.strip()]

    start_idx = None
    for i, ln in enumerate(lines[:2000]):  # avoid scanning huge documents forever
        low = ln.lower()
        if any(h in low for h in headings):
            start_idx = i + 1
            break
    if start_idx is None:
        return []

    items: list[str] = []
    for ln in lines[start_idx : start_idx + 250]:
        if len(items) >= max_items:
            break
        low = ln.lower()
        if any(h in low for h in headings) and len(items) > 3:
            break
        if len(ln) < 3:
            continue
        if len(ln) > 180:
            continue
        items.append(ln)
    # De-dupe preserving order
    seen: set[str] = set()
    out: list[str] = []
    for it in items:
        key = it.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(it)
    return out


def _first_match(text: str, pattern: str) -> str | None:
    m = re.search(pattern, text, flags=re.IGNORECASE)
    if not m:
        return None
    # prefer last capturing group if present
    return (m.group(m.lastindex) if m.lastindex else m.group(0)).strip()

