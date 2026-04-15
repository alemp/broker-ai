from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class NormalizedCoverage:
    raw: str
    code: str | None
    label: str | None
    confidence: int  # 0..100
    matched_synonym: str | None


def normalize_coverages(
    coverages_raw: list[str],
    *,
    taxonomy: list[dict[str, object]],
) -> list[NormalizedCoverage]:
    """
    Deterministic keyword/synonym matcher.

    taxonomy item shape:
      { code: str, label: str, synonyms: list[str] }
    """
    normalized: list[NormalizedCoverage] = []
    for raw in coverages_raw:
        norm = _normalize_one(raw, taxonomy)
        normalized.append(norm)
    return normalized


def _normalize_one(raw: str, taxonomy: list[dict[str, object]]) -> NormalizedCoverage:
    raw_clean = _clean(raw)
    if not raw_clean:
        return NormalizedCoverage(
            raw=raw,
            code=None,
            label=None,
            confidence=0,
            matched_synonym=None,
        )

    best: NormalizedCoverage | None = None
    for item in taxonomy:
        code = str(item.get("code") or "")
        label = str(item.get("label") or "")
        synonyms_obj = item.get("synonyms") or []
        synonyms = [str(s) for s in synonyms_obj if isinstance(s, (str, int, float))]
        for syn in [label, *synonyms]:
            syn_clean = _clean(syn)
            if not syn_clean:
                continue
            score = _score_match(raw_clean, syn_clean)
            if score <= 0:
                continue
            candidate = NormalizedCoverage(
                raw=raw,
                code=code or None,
                label=label or None,
                confidence=score,
                matched_synonym=syn,
            )
            if best is None or candidate.confidence > best.confidence:
                best = candidate

    return best or NormalizedCoverage(
        raw=raw,
        code=None,
        label=None,
        confidence=10,
        matched_synonym=None,
    )


def _score_match(raw: str, syn: str) -> int:
    if raw == syn:
        return 100
    if syn in raw:
        return 85 if len(syn) >= 6 else 70
    # token overlap
    raw_tokens = set(raw.split())
    syn_tokens = set(syn.split())
    if not raw_tokens or not syn_tokens:
        return 0
    inter = raw_tokens & syn_tokens
    if not inter:
        return 0
    overlap = len(inter) / max(len(syn_tokens), 1)
    return int(40 + overlap * 40)


def _clean(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9áàâãéèêíìîóòôõúùûç \-\/]", " ", s)
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()

