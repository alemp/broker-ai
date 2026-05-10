"""Heuristic extraction of motor proposals (auto) from PDF text.

For Phase 2 the extractor is regex-based and tuned to the layout of the
design partner's PDFs (Bradesco Auto/RE). Output mirrors the carrier's
canonical pt-BR JSON shape so the existing JSON adapter
(`bradesco_json_v1`) can produce the canonical English payload via a single
code path. Anything missing simply remains `None` and the canonical
validation downstream surfaces the gaps as `requires_review=True`.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class AutoProposalRawExtraction:
    """Bradesco-shaped raw extraction (pt-BR keys), pre-adapter."""

    raw: dict[str, object]
    confidence: int
    requires_review: bool


_NUMBER_RE = re.compile(
    r"(?:proposta|cota[cç][aã]o|n[uú]mero da cota[cç][aã]o)\s*(?:n[ºo°]?\s*)?[:\-]?\s*"
    r"([0-9A-Z][0-9A-Z\-\/\.]{3,39})",
    re.IGNORECASE,
)
# Bradesco "Demonstrativo de Cálculo" PDFs use the carrier-internal "Estudo:"
# label for the quote number (column-block layout — value lives on the next
# non-empty line). The standard regex can match a generic label like
# "DEMONSTRATIVO" right after "Cotação:", so we prefer this anchor when present.
_QUOTE_NUMBER_ESTUDO_RE = re.compile(
    r"\bEstudo\s*[:\-]?\s*\n?\s*([0-9][0-9A-Z\-\/\.]{3,30})",
    re.IGNORECASE,
)
# Words/labels that occasionally leak into value slots when pypdf flattens
# column-block layouts. They are never legitimate values for the listed fields.
_QUOTE_NUMBER_DENYLIST = frozenset(
    {"DEMONSTRATIVO", "CALCULO", "CÁLCULO", "DATA", "HORA", "VERSÃO", "VERSAO"}
)
_VEHICLE_VALUE_DENYLIST = frozenset(
    {"MARCA", "MODELO", "TIPO", "USO", "ZERO", "PARTICULAR", "EQUIPAMENTOS"}
)
_VALID_UNTIL_RE = re.compile(
    r"(?:validade|v[aá]lid[oa]\s*at[eé])\s*[:\-]?\s*([0-3]?\d[/-][01]?\d[/-]\d{2,4})",
    re.IGNORECASE,
)
_DATA_CALCULO_RE = re.compile(
    r"data\s*do?\s*c[aá]lculo\s*[:\-]?\s*([0-3]?\d[/-][01]?\d[/-]\d{2,4})"
    r"(?:\s+([0-2]?\d:[0-5]\d(?::[0-5]\d)?))?",
    re.IGNORECASE,
)
_INSURER_RE = re.compile(
    r"(Bradesco\s+Auto(?:/RE?)?\s+Companhia\s+de\s+Seguros|Bradesco\s+Seguros)",
    re.IGNORECASE,
)
_PRODUCT_RE = re.compile(
    r"(BRADESCO\s+SEGURO\s+AUTO(?:\s+(?:PRIME|CLASSIC|MAX|RCF|FROTA))?)",
    re.IGNORECASE,
)
_CPF_RE = re.compile(r"\b(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})\b")
_CNPJ_RE = re.compile(r"\b(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}|\d{14})\b")
_PROPONENT_NAME_RE = re.compile(
    r"(?:proponente|segurado)\s*[:\-]\s*"
    r"([A-ZÁÉÍÓÚÂÊÔÃÕÇ]+(?:[ \-'][A-ZÁÉÍÓÚÂÊÔÃÕÇ]+){1,5})\b",
    re.IGNORECASE,
)
# Block-layout fallback: pypdf often serializes Bradesco's "Demonstrativo de
# Cálculo" with all labels first and all values second, so the inline regex
# above never matches. A reliable anchor is the first CPF found in the text
# (the proponent's tax id, which the existing tax_id extractor relies on);
# the proponent name is the closest 2+ all-caps token line preceding it.
_NAME_LINE_RE = re.compile(r"^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ \-']{3,80}$")
_NAME_BLOCK_HEADERS = frozenset(
    {
        "DADOS DO SEGURO",
        "DADOS DO PROPONENTE",
        "DADOS DO CORRETOR",
        "OBJETO DO SEGURO",
        "DADOS DA APÓLICE",
        "DEMONSTRATIVO DE CÁLCULO",
        "CLÁUSULAS",
        "FRANQUIAS",
    }
)
_BIRTH_RE = re.compile(
    r"(?:data\s*(?:de\s*)?nascimento|nascimento)\s*[:\-]?\s*([0-3]?\d[/-][01]?\d[/-]\d{2,4})",
    re.IGNORECASE,
)
_PLATE_RE = re.compile(r"\b([A-Z]{3}-?\d{1}[A-Z0-9]\d{2})\b")
_CHASSIS_RE = re.compile(r"\b([A-HJ-NPR-Z0-9]{17})\b")
_FIPE_RE = re.compile(r"(?:c[oó]digo\s*fipe|fipe)\s*[:\-]?\s*([0-9A-Z\-]{4,16})", re.IGNORECASE)
_YEAR_FAB_RE = re.compile(r"ano\s*(?:de\s*)?fabrica[cç][aã]o\s*[:\-]?\s*(\d{4})", re.IGNORECASE)
_YEAR_MOD_RE = re.compile(r"ano\s*(?:do?\s*)?modelo\s*[:\-]?\s*(\d{4})", re.IGNORECASE)
_VEHICLE_LINE_RE = re.compile(
    r"(?:ve[ií]culo|marca\s*/\s*modelo)\s*[:\-]?\s*([A-Z][A-Z0-9 \-/.]{3,80})",
    re.IGNORECASE,
)
_PREMIUM_TOTAL_RE = re.compile(
    r"(?:total\s*a\s*pagar|pr[eê]mio\s*total|total\s*do\s*pr[eê]mio)\s*[:R$\-]*\s*"
    r"([0-9.]{1,12},\d{2})",
    re.IGNORECASE,
)
_PREMIUM_NET_RE = re.compile(
    r"pr[eê]mio\s*l[íi]quido\s*[:R$\-]*\s*([0-9.]{1,12},\d{2})",
    re.IGNORECASE,
)
_IOF_RE = re.compile(r"\biof\s*[:R$\-]*\s*([0-9.]{1,12},\d{2})", re.IGNORECASE)
_CLAUSE_RE = re.compile(
    r"^\s*(\d{3})\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^\n]{4,120})$",
    re.MULTILINE,
)
# Bradesco "Demonstrativo de Cálculo" lists clauses inline as
# "(001) Cobertura Compreensiva (106) Assist Auto Prime …" — multiple per line,
# wrapped across paragraphs. This regex captures one ``(NNN) description`` at a
# time, stopping at the next ``(NNN)`` token or end of input.
_CLAUSE_INLINE_RE = re.compile(
    r"\((\d{3})\)\s*([^()\n]+?)(?=\s*\(\d{3}\)|\s*$)",
    re.MULTILINE,
)
# Known automotive makes used as anchors in column-block vehicle extraction.
# Conservative list focused on the Brazilian market; missing makes simply fall
# through and the extractor leaves ``marca``/``modelo`` as ``None``.
_KNOWN_VEHICLE_MAKES = frozenset(
    {
        "JEEP",
        "FIAT",
        "FORD",
        "VOLKSWAGEN",
        "VW",
        "TOYOTA",
        "HYUNDAI",
        "HONDA",
        "RENAULT",
        "CHEVROLET",
        "MITSUBISHI",
        "NISSAN",
        "AUDI",
        "BMW",
        "MERCEDES-BENZ",
        "MERCEDES",
        "VOLVO",
        "PEUGEOT",
        "CITROEN",
        "KIA",
        "SUBARU",
        "LAND ROVER",
        "RANGE ROVER",
        "JAGUAR",
        "PORSCHE",
        "TESLA",
        "CHERY",
        "JAC",
        "BYD",
        "GWM",
        "HAVAL",
        "RAM",
        "SUZUKI",
        "DODGE",
        "TROLLER",
    }
)
_VEHICLE_MAKE_LINE_RE = re.compile(r"^[A-ZÁÉÍÓÚÂÊÔÃÕÇ\- ]{2,30}$")
_FIPE_VALUE_RE = re.compile(r"\b(\d{6}-\d|\d{7})\b")


def _money_str_to_float(value: str | None) -> float | None:
    if value is None:
        return None
    cleaned = value.replace(".", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _to_iso_date(value: str | None) -> str | None:
    if not value:
        return None
    parts = re.split(r"[/-]", value)
    if len(parts) != 3:
        return None
    day, month, year = parts[0], parts[1], parts[2]
    if len(year) == 2:
        year = "20" + year if int(year) < 50 else "19" + year
    try:
        return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
    except ValueError:
        return None


def _first(text: str, pattern: re.Pattern[str], group: int = 1) -> str | None:
    m = pattern.search(text)
    if not m:
        return None
    return m.group(group).strip()


def _slice_section(
    text: str,
    start_anchor: str,
    end_anchors: tuple[str, ...] = (),
) -> str:
    """Return the substring between ``start_anchor`` and the next end anchor.

    Returns ``""`` when the start anchor is not present. Comparisons are
    case-insensitive. Used by block-aware extractors that need to reason
    about a specific section (e.g. ``OBJETO DO SEGURO``) without
    interference from neighbouring blocks.
    """
    upper = text.upper()
    start = upper.find(start_anchor.upper())
    if start < 0:
        return ""
    body = text[start:]
    upper_body = upper[start:]
    end = len(body)
    for anchor in end_anchors:
        idx = upper_body.find(anchor.upper(), len(start_anchor))
        if 0 <= idx < end:
            end = idx
    return body[:end]


def _quote_number_from_text(text: str) -> str | None:
    """Extract the carrier-side quote number, preferring the Bradesco DC anchor."""
    estudo = _first(text, _QUOTE_NUMBER_ESTUDO_RE)
    if estudo:
        return estudo
    candidate = _first(text, _NUMBER_RE)
    if candidate is None:
        return None
    if candidate.upper() in _QUOTE_NUMBER_DENYLIST:
        return None
    return candidate


def _vehicle_block_from_text(text: str) -> dict[str, object]:
    """Block-aware vehicle extraction (Bradesco DC layout).

    Anchors on ``OBJETO DO SEGURO`` to bound the section, then identifies
    ``chassi`` / ``placa`` / ``codigo_fipe`` / ``ano_*`` by their own value
    patterns (VIN, plate format, 7-digit FIPE, 1990-2099 year). ``marca``
    and ``modelo`` are inferred by anchoring on a known make line and
    taking the closest non-label, non-numeric line above it as the model.

    Returns a dict with the carrier-shaped keys; missing fields stay ``None``.
    """
    section = _slice_section(
        text,
        "OBJETO DO SEGURO",
        end_anchors=("CLÁUSULAS", "CLAUSULAS", "LIMITES MÁXIMOS", "DADOS DO CORRETOR"),
    )
    if not section:
        return {}

    chassis = _first(section, _CHASSIS_RE)
    plate = _first(section, _PLATE_RE)
    fipe_match = _FIPE_VALUE_RE.search(section)
    fipe = fipe_match.group(1) if fipe_match else None

    year_re = re.compile(r"\b(19[9]\d|20\d{2})\b")
    years = year_re.findall(section)
    fab_year = years[0] if len(years) >= 1 else None
    mod_year = years[1] if len(years) >= 2 else fab_year

    make: str | None = None
    model: str | None = None
    lines = [line.strip() for line in section.splitlines() if line.strip()]
    for i, line in enumerate(lines):
        upper = line.upper()
        if upper in _KNOWN_VEHICLE_MAKES and _VEHICLE_MAKE_LINE_RE.fullmatch(line):
            make = line
            for j in range(i - 1, -1, -1):
                cand = lines[j]
                if cand.endswith(":") or cand.upper() in _NAME_BLOCK_HEADERS:
                    continue
                if cand.upper() in _VEHICLE_VALUE_DENYLIST:
                    continue
                if year_re.fullmatch(cand) or cand.isdigit():
                    continue
                if len(cand) >= 4:
                    model = cand
                    break
            break

    return {
        "marca": make,
        "modelo": model,
        "ano_fabricacao": int(fab_year) if fab_year else None,
        "ano_modelo": int(mod_year) if mod_year else None,
        "placa": plate.replace("-", "") if plate else None,
        "chassi": chassis,
        "codigo_fipe": fipe,
    }


def _is_label_like(value: str | None) -> bool:
    """True when ``value`` looks like a leaked label rather than data."""
    if value is None:
        return True
    upper = value.strip().upper()
    return upper in _VEHICLE_VALUE_DENYLIST


def _extract_inline_clauses(text: str) -> list[dict[str, str]]:
    """Parse the Bradesco DC ``(001) ... (106) ...`` paragraph format."""
    items: list[dict[str, str]] = []
    seen: set[str] = set()
    section = _slice_section(
        text,
        "CLÁUSULAS",
        end_anchors=("Página", "PROCESSO SUSEP", "CÁLCULO", "DEMONSTRATIVO DE CÁLCULO"),
    )
    if not section:
        section = text
    for m in _CLAUSE_INLINE_RE.finditer(section):
        code = m.group(1).strip()
        description = re.sub(r"\s+", " ", m.group(2)).strip(" -")
        if not description or len(description) < 4:
            continue
        if code in seen:
            continue
        seen.add(code)
        items.append({"codigo": code, "descricao": description})
    return items


def _proponent_name_from_block(text: str) -> str | None:
    """Fallback name extractor for column-block PDF layouts (Bradesco DC, etc.).

    Strategy: anchor on the **first CPF** in the document — the regex pipeline
    already treats it as the proponent's tax id — and walk backwards picking
    the closest non-empty line that:

    - is all-caps (with pt-BR diacritics)
    - has 2+ tokens
    - contains no colon (so it is a value, not a label)
    - is not a known section header (``DADOS DO PROPONENTE`` etc.)

    Returns ``None`` when no such line is found, leaving the canonical
    validation to surface the gap as ``requires_review=True``.
    """
    cpf_match = _CPF_RE.search(text)
    if cpf_match is None:
        return None
    prefix = text[: cpf_match.start()]
    for raw_line in reversed(prefix.splitlines()):
        s = raw_line.strip()
        if not s or ":" in s:
            continue
        if s.upper() in _NAME_BLOCK_HEADERS:
            continue
        if not _NAME_LINE_RE.fullmatch(s):
            continue
        if len(s.split()) < 2:
            continue
        return s
    return None


def _extract_clauses(text: str) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    seen: set[str] = set()
    for m in _CLAUSE_RE.finditer(text):
        code = m.group(1).strip()
        description = m.group(2).strip()
        if code in seen:
            continue
        seen.add(code)
        items.append({"codigo": code, "descricao": description})
    return items


def extract_auto_proposal(compact_text: str, raw_text: str) -> AutoProposalRawExtraction:
    """Heuristic motor-proposal extraction; returns Bradesco-shaped raw dict.

    Returned dict matches the carrier's pt-BR layout, which is then fed into
    `BradescoAutoJsonAdapterV1` to land on the canonical English payload.

    `raw_text` (with newlines preserved by pypdf/OCR) is preferred because the
    line boundaries make the heuristics unambiguous; the compact variant is a
    fallback when callers do not have the line-broken version handy.
    """
    text = raw_text or compact_text or ""
    if not text.strip():
        return AutoProposalRawExtraction(
            raw={},
            confidence=0,
            requires_review=True,
        )

    quote_number = _quote_number_from_text(text)
    valid_until = _to_iso_date(_first(text, _VALID_UNTIL_RE))
    calc_match = _DATA_CALCULO_RE.search(text)
    data_calculo = _to_iso_date(calc_match.group(1)) if calc_match else None
    hora_calculo = calc_match.group(2) if calc_match and calc_match.group(2) else None

    insurer_name = _first(text, _INSURER_RE)
    product_name = _first(text, _PRODUCT_RE)

    proponent_name = _first(text, _PROPONENT_NAME_RE) or _proponent_name_from_block(text)
    cpf = _first(text, _CPF_RE)
    cnpj = _first(text, _CNPJ_RE)
    birth = _to_iso_date(_first(text, _BIRTH_RE))

    inline_vehicle = _first(text, _VEHICLE_LINE_RE)
    block_vehicle = _vehicle_block_from_text(text)

    def _pick_vehicle(inline: str | None, block: str | None) -> str | None:
        if inline and not _is_label_like(inline):
            return inline
        return block

    plate_inline = _first(text, _PLATE_RE)
    chassis_inline = _first(text, _CHASSIS_RE)
    fipe_inline = _first(text, _FIPE_RE)
    fab_year_inline = _first(text, _YEAR_FAB_RE)
    mod_year_inline = _first(text, _YEAR_MOD_RE)

    plate = plate_inline or block_vehicle.get("placa")
    chassis = chassis_inline or block_vehicle.get("chassi")
    fipe = fipe_inline if fipe_inline and not _is_label_like(fipe_inline) else block_vehicle.get(
        "codigo_fipe",
    )
    fab_year = int(fab_year_inline) if fab_year_inline else block_vehicle.get("ano_fabricacao")
    mod_year = int(mod_year_inline) if mod_year_inline else block_vehicle.get("ano_modelo")
    vehicle_model = _pick_vehicle(inline_vehicle, block_vehicle.get("modelo"))  # type: ignore[arg-type]
    vehicle_make = block_vehicle.get("marca")

    premium_total = _money_str_to_float(_first(text, _PREMIUM_TOTAL_RE))
    premium_net = _money_str_to_float(_first(text, _PREMIUM_NET_RE))
    iof = _money_str_to_float(_first(text, _IOF_RE))

    clauses = _extract_inline_clauses(text) or _extract_clauses(text)

    raw_proposal: dict[str, object] = {
        "cotacao": {
            "numero": quote_number,
            "data_calculo": data_calculo,
            "hora_calculo": hora_calculo,
            "validade": valid_until,
            "item": 1,
            "seguradora": insurer_name,
            "produto": {"nome": product_name} if product_name else None,
            "tipo_cliente": "Individual" if cpf else None,
        },
        "proponente": {
            "nome": proponent_name,
            "cpf_cnpj": cpf or cnpj,
            "tipo_pessoa": "Fisica" if cpf else ("Juridica" if cnpj else None),
            "data_nascimento": birth,
        },
        "veiculo": {
            "marca": vehicle_make,
            "modelo": vehicle_model,
            "ano_fabricacao": fab_year,
            "ano_modelo": mod_year,
            "placa": plate.replace("-", "") if plate else None,
            "chassi": chassis,
            "codigo_fipe": fipe,
        },
        "coberturas": {},
        "premio": {
            "liquido": premium_net,
            "iof": iof,
            "total": premium_total,
            "total_pagar": premium_total,
        },
        "clausulas": clauses,
    }

    score = 0
    if quote_number:
        score += 25
    if insurer_name:
        score += 10
    if product_name:
        score += 10
    if proponent_name and (cpf or cnpj):
        score += 20
    if plate or chassis:
        score += 15
    if premium_total is not None:
        score += 15
    if clauses:
        score += 5
    confidence = min(score, 100)
    return AutoProposalRawExtraction(
        raw=raw_proposal,
        confidence=confidence,
        requires_review=confidence < 70,
    )
