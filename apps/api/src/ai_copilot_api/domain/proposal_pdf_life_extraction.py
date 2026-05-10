"""Heuristic extraction of Tokio Marine PME group-life proposals from PDF text.

Output matches the pt-BR ``proposta_seguro_vida`` object consumed by
:class:`TokioLifeJsonAdapterV1`, so PDF and JSON channels share one
normalization path.

Tuned for layouts where pypdf emits labels and values on the same or adjacent
lines (quotation number, estipulante, CNPJ, coberturas, precificação).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

_CNPJ_RE = re.compile(r"\b(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}|\d{14})\b")
_CPF_RE = re.compile(r"\b(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})\b")
# Cotação / proposta number (Tokio uses 7-digit ids)
_QUOTE_NUM_RE = re.compile(
    r"(?:cota[cç][aã]o|n[úu]mero\s*(?:da\s*)?cota[cç][aã]o|proposta)"
    r"\s*(?:n[ºo°.]?\s*)?[:\-]?\s*(\d{6,12})\b",
    re.IGNORECASE,
)
_DATA_BR_RE = re.compile(
    r"(?:\b|\s)([0-3]?\d)[/.]([01]?\d)[/.](\d{4})\b",
)
_HORA_RE = re.compile(r"\b([01]?\d:[0-5]\d(?::[0-5]\d)?)\b")
# Optional R$; Brazilian thousands + cents, or smaller amounts with cents only.
_MONEY_BR_RE = re.compile(
    r"(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})",
    re.IGNORECASE,
)
_VALIDADE_DIAS_RE = re.compile(
    r"(?:validade|v[aá]lida)\s*(?:da\s*cota[cç][aã]o)?\s*[:\-]?\s*(\d+)\s*(?:dias?|d\.)",
    re.IGNORECASE,
)
_QTD_VIDAS_RE = re.compile(
    r"(?:quantidade\s*(?:de\s*)?vidas|n[úu]mero\s*de\s*vidas|vidas)\s*[:\-]?\s*(\d+)",
    re.IGNORECASE,
)
_MULTI_SAL_RE = re.compile(
    r"(?:multiplicador|m[úu]ltiplo)\s*(?:salarial|do\s*sal[aá]rio)?\s*[:\-]?\s*(\d{1,3})",
    re.IGNORECASE,
)
_CAPITAL_TOTAL_RE = re.compile(
    r"capital\s*total\s*[:\-]?\s*(?:r\$\s*)?([\d]{1,3}(?:\.[\d]{3})*,\d{2}|\d+,\d{2})",
    re.IGNORECASE,
)
_FATURA_MENSAL_RE = re.compile(
    r"fatura\s*mensal\s*[:\-]?\s*(?:r\$\s*)?([\d]{1,3}(?:\.[\d]{3})*,\d{2}|\d+,\d{2})",
    re.IGNORECASE,
)
_PREMIO_TOTAL_COB_RE = re.compile(
    r"(?:pr[eê]mio\s*total\s*(?:das\s*)?coberturas|total\s*coberturas)\s*[:\-]?\s*(?:r\$\s*)?"
    r"([\d]{1,3}(?:\.[\d]{3})*,\d{2}|\d+,\d{2})",
    re.IGNORECASE,
)
_TOKIO_INSURER_RE = re.compile(
    r"(Tokio\s+Marine\s+Seguradora\s*(?:S\.?\s*A\.?)?)",
    re.IGNORECASE,
)
_SUSEP_REG_RE = re.compile(
    r"(?:registro\s*)?susep\s*[:\-]?\s*"
    r"([0-9]{3,5}\s*[-–]\s*[0-9]/?[0-9]{4}[-–/][0-9]{2})",
    re.IGNORECASE,
)
_RAZAO_RE = re.compile(
    r"(?:raz[aã]o\s*social|estipulante)\s*[:\-]?\s*(.+?)(?:\n|$)",
    re.IGNORECASE,
)
_FORMA_ADESAO_RE = re.compile(
    r"(?:forma\s*(?:de\s*)?ades[aã]o|ades[aã]o)\s*[:\-]?\s*(Compuls[oó]ria|Opcional)",
    re.IGNORECASE,
)
_CUSTEIO_RE = re.compile(
    r"custeio\s*[:\-]?\s*((?:N[aã]o\s*)?Contribut[aá]rio)",
    re.IGNORECASE,
)
_PLANO_SAUDE_RE = re.compile(
    r"(?:possui|com)\s*plano\s*de\s*sa[uú]de\s*[:\-]?\s*(sim|n[aã]o|s|n)\b",
    re.IGNORECASE,
)
_COD_CORRETORA_RE = re.compile(
    r"(?:c[oó]digo\s*(?:da\s*)?corretora|corretora\s*n[ºo]?)\s*[:\-]?\s*(\d{4,8})\b",
    re.IGNORECASE,
)
_NOME_CORRETORA_RE = re.compile(
    r"(?:nome\s*(?:da\s*)?corretora|corretora)\s*[:\-]?\s*(.+?)(?:\n|c[oó]digo|susep|$)",
    re.IGNORECASE,
)

# Description on PDF → canonical carrier code (subset of Tokio JSON codes)
_DESC_TO_CODE: tuple[tuple[str, str], ...] = (
    ("indenização especial por acidente", "IEA"),
    ("invalidez permanente total ou parcial por acidente", "IPA"),
    ("invalidez permanente", "IPA"),
    ("morte acidental", "MORTE_ACIDENTAL"),
    ("morte natural", "MN"),
    ("\bmorte\b", "BASICA_MORTE"),
    ("doenças graves", "DOENCAS_GRAVES"),
    ("auxílio funeral", "AF"),
    ("diária hospitalar", "DH"),
)

_CODE_INLINE_RE = re.compile(
    r"\b(BASICA_MORTE|IEA|IPA|MN|MA|DG|AF|DH|DIH|MORTE_ACIDENTAL|DOENCAS_GRAVES|AUXILIO_FUNERAL)\b",
    re.IGNORECASE,
)


def _digits_only(value: str | None) -> str | None:
    if not value:
        return None
    d = re.sub(r"\D", "", value)
    return d or None


def _money_to_decimal(s: str | None) -> Decimal | None:
    if not s:
        return None
    t = s.strip().replace(".", "").replace(",", ".")
    try:
        return Decimal(t)
    except Exception:
        return None


def _first_money_in_line(line: str) -> Decimal | None:
    m = _MONEY_BR_RE.search(line)
    return _money_to_decimal(m.group(1)) if m else None


def _all_money_in_line(line: str) -> list[Decimal]:
    out: list[Decimal] = []
    for m in _MONEY_BR_RE.finditer(line):
        v = _money_to_decimal(m.group(1))
        if v is not None:
            out.append(v)
    return out


def _first_date_iso(text: str) -> str | None:
    m = _DATA_BR_RE.search(text)
    if not m:
        return None
    d, mo, y = m.group(1), m.group(2), m.group(3)
    try:
        return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"
    except ValueError:
        return None


def _looks_like_tokio_life(compact_lower: str) -> bool:
    if "tokio" not in compact_lower:
        return False
    return any(
        k in compact_lower
        for k in (
            "vida",
            "pme",
            "seguro de vida",
            "vida empresa",
            "ap funcion",
            "grupo segurado",
        )
    )


def _extract_razao_social(raw: str) -> str | None:
    m = _RAZAO_RE.search(raw)
    if m:
        name = m.group(1).strip()
        if len(name) >= 4 and not name.lower().startswith("cnpj"):
            return name[:255]
    # Block before first CNPJ: company name often appears on previous line
    cnpj_m = _CNPJ_RE.search(raw)
    if cnpj_m:
        before = raw[: cnpj_m.start()]
        lines = [ln.strip() for ln in before.splitlines() if ln.strip()]
        for ln in reversed(lines[-8:]):
            if _CNPJ_RE.search(ln) or _CPF_RE.search(ln):
                continue
            if len(ln) >= 6 and not ln.isdigit() and "tokio" not in ln.lower():
                if not re.match(r"^[:\-\s]+$", ln):
                    return ln[:255]
    return None


def _extract_coverage_rows(raw: str) -> list[dict[str, Any]]:
    lines = [ln.strip() for ln in raw.splitlines()]
    rows: list[dict[str, Any]] = []
    seen_codes: set[str] = set()
    for i, stripped in enumerate(lines):
        if len(stripped) < 4:
            continue
        lower = stripped.lower()
        cm = _CODE_INLINE_RE.search(stripped)
        code = cm.group(1).upper() if cm else None
        desc = None
        if code is None:
            for needle, c in _DESC_TO_CODE:
                if re.search(needle, lower):
                    code = c
                    desc = stripped[:200]
                    break
        if code is None or code in seen_codes:
            continue
        seen_codes.add(code)
        amounts = list(_all_money_in_line(stripped))
        # PDFs often put capitais/prêmio on the following lines (column layout).
        if len(amounts) < 3:
            stop_kw = ("fatura mensal", "precifica", "prêmio total", "total a pagar")
            j = i + 1
            while j < len(lines) and j < i + 10:
                nxt = lines[j]
                j += 1
                if not nxt:
                    continue
                nxt_lower = nxt.lower()
                if any(k in nxt_lower for k in stop_kw):
                    break
                next_code = _CODE_INLINE_RE.search(nxt)
                if next_code and next_code.group(1).upper() != code:
                    break
                extra = _all_money_in_line(nxt)
                if extra:
                    amounts.extend(extra)
                if len(amounts) >= 3:
                    break
                if len(amounts) >= 2 and j < len(lines):
                    peek = lines[j] if j < len(lines) else ""
                    if peek and not _all_money_in_line(peek) and _CODE_INLINE_RE.search(peek):
                        break

        cap: Decimal | None = None
        cap_max: Decimal | None = None
        prem: Decimal | None = None
        if len(amounts) >= 3:
            cap = amounts[0]
            cap_max = amounts[1]
            prem = amounts[-1]
        elif len(amounts) == 2:
            cap, prem = amounts[0], amounts[1]
            cap_max = cap
        elif len(amounts) == 1:
            cap = amounts[0]
            cap_max = cap
        if desc is None:
            desc = _CODE_INLINE_RE.sub("", stripped).strip() or code.replace("_", " ").title()
        rows.append(
            {
                "codigo": code,
                "descricao": desc[:255],
                "percentual_indenizacao": 100.0 if cap is not None else None,
                "capital_segurado_minimo": float(cap) if cap is not None else None,
                "capital_segurado_maximo": float(cap_max) if cap_max is not None else None,
                "premio": float(prem) if prem is not None else None,
            },
        )
    return rows


@dataclass(frozen=True)
class TokioLifePdfRawExtraction:
    """Intermediate Tokio-shaped dict (``proposta_seguro_vida`` body only)."""

    tokio_inner: dict[str, Any]
    confidence: int
    requires_review: bool


def extract_tokio_life_pme_proposal(raw_text: str, compact_text: str) -> TokioLifePdfRawExtraction:
    """Parse Tokio Marine PME vida quotation text into a ``proposta_seguro_vida``-shaped dict."""
    compact_lower = compact_text.lower()
    if not _looks_like_tokio_life(compact_lower):
        return TokioLifePdfRawExtraction(tokio_inner={}, confidence=0, requires_review=True)

    quote_num = None
    qm = _QUOTE_NUM_RE.search(raw_text) or _QUOTE_NUM_RE.search(compact_text)
    if qm:
        quote_num = qm.group(1).strip()

    insurer_m = _TOKIO_INSURER_RE.search(raw_text) or _TOKIO_INSURER_RE.search(compact_text)
    insurer_name = insurer_m.group(1).strip() if insurer_m else "Tokio Marine Seguradora S.A."

    susep_m = _SUSEP_REG_RE.search(raw_text)
    registro_susep = None
    if susep_m:
        registro_susep = re.sub(r"\s+", "", susep_m.group(1).replace("–", "-"))

    razao = _extract_razao_social(raw_text)
    cnpj_m = _CNPJ_RE.search(raw_text)
    cnpj_raw = cnpj_m.group(1) if cnpj_m else None

    data_ref = _first_date_iso(raw_text)
    hora_m = _HORA_RE.search(raw_text)
    hora = hora_m.group(1) if hora_m else None

    validade_dias = None
    vm = _VALIDADE_DIAS_RE.search(raw_text) or _VALIDADE_DIAS_RE.search(compact_text)
    if vm:
        try:
            validade_dias = int(vm.group(1))
        except ValueError:
            validade_dias = None

    tipo_produto = None
    if "pme" in compact_lower and "vida" in compact_lower:
        tpm = re.search(
            r"(PME\s+Vida\s+Empresa|PME\s+Vida|Vida\s+Empresa)",
            raw_text,
            re.IGNORECASE,
        )
        tipo_produto = tpm.group(1).strip() if tpm else "PME Vida Empresa"

    coberturas = _extract_coverage_rows(raw_text)

    vidas_m = _QTD_VIDAS_RE.search(raw_text) or _QTD_VIDAS_RE.search(compact_text)
    lives = int(vidas_m.group(1)) if vidas_m else None

    forma_adesao = None
    fa_m = _FORMA_ADESAO_RE.search(raw_text)
    if fa_m:
        forma_adesao = fa_m.group(1).strip()

    custeio = None
    cu_m = _CUSTEIO_RE.search(raw_text)
    if cu_m:
        custeio = cu_m.group(1).strip()

    possui_plano: bool | None = None
    ps_m = _PLANO_SAUDE_RE.search(raw_text)
    if ps_m:
        possui_plano = ps_m.group(1).lower() in ("sim", "s")

    mult_m = _MULTI_SAL_RE.search(raw_text) or _MULTI_SAL_RE.search(compact_text)
    multiplicador = None
    if mult_m:
        try:
            multiplicador = int(mult_m.group(1))
        except ValueError:
            multiplicador = None

    cap_tot_m = _CAPITAL_TOTAL_RE.search(raw_text)
    capital_total = _first_money_in_line(cap_tot_m.group(0)) if cap_tot_m else None

    fat_m = _FATURA_MENSAL_RE.search(raw_text)
    prem_tot_m = _PREMIO_TOTAL_COB_RE.search(raw_text)
    fatura = _first_money_in_line(fat_m.group(0)) if fat_m else None
    prem_cob = _first_money_in_line(prem_tot_m.group(0)) if prem_tot_m else None

    cor_cod = None
    cc_m = _COD_CORRETORA_RE.search(raw_text)
    if cc_m:
        cor_cod = cc_m.group(1).strip()
    cor_nome = None
    cn_m = _NOME_CORRETORA_RE.search(raw_text)
    if cn_m:
        cor_nome = cn_m.group(1).strip()[:255]

    inner: dict[str, Any] = {
        "tipo_produto": tipo_produto,
        "tipo_seguro": "Novo",
        "seguradora": {
            "nome": insurer_name,
            "registro_susep": registro_susep,
        },
        "cotacao": {
            "numero": quote_num,
            "data_referencia": data_ref,
            "data_impressao": data_ref,
            "hora_impressao": hora,
            "validade_dias": validade_dias,
        },
        "estipulante": {
            "razao_social": razao,
            "cnpj": cnpj_raw,
        },
        "corretora": {"codigo": cor_cod, "nome": cor_nome} if (cor_cod or cor_nome) else None,
        "perfil_grupo": {
            "quantidade_vidas": lives,
            "forma_adesao": forma_adesao,
            "custeio": custeio,
            "possui_plano_saude": possui_plano,
        },
        "capital_segurado": {
            "forma_calculo": "Múltiplo Salarial" if multiplicador else None,
            "multiplicador_salario": multiplicador,
            "capital_total": float(capital_total) if capital_total is not None else None,
        },
        "coberturas": coberturas,
        "precificacao": {
            "fatura_mensal": float(fatura) if fatura is not None else None,
            "premio_total_coberturas": float(prem_cob) if prem_cob is not None else None,
        },
    }

    score = 0
    if quote_num:
        score += 20
    if insurer_name:
        score += 10
    if razao and cnpj_raw:
        score += 25
    elif razao or cnpj_raw:
        score += 10
    if coberturas:
        score += 20
    if fatura is not None or prem_cob is not None:
        score += 15
    if lives is not None:
        score += 5
    if capital_total is not None:
        score += 5
    confidence = min(score, 100)
    requires_review = confidence < 55 or not coberturas

    return TokioLifePdfRawExtraction(
        tokio_inner=inner,
        confidence=confidence,
        requires_review=requires_review,
    )


__all__ = [
    "TokioLifePdfRawExtraction",
    "extract_tokio_life_pme_proposal",
]
