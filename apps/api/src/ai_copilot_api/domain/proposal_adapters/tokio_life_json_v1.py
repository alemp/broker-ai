"""Adapter: Tokio Marine PME group life JSON (pt-BR keys) → canonical life payload.

The carrier emits Portuguese-keyed payloads under a single root key
``proposta_seguro_vida``. This adapter translates them into the English
:class:`ai_copilot_api.schemas.proposal_ingest.LifeProposalPayload` shape
(returned as a dict so that the single Pydantic validation pass at the API
boundary remains the only gate).

Reference shape (excerpt) — ``cotacao``, ``seguradora``, ``estipulante``,
``corretora``, ``perfil_grupo``, ``capital_segurado``, ``coberturas``,
``precificacao``, ``condicoes_aceitacao``, ``vigencia``.

Notes:

- ``estipulante`` (the policyholder = company) becomes the canonical
  ``applicant``; group life is always corporate (CNPJ).
- ``coberturas[]`` produces ``coverage_items[]`` (full carrier detail) **and**
  populates the flat ``coverages`` decimals via a code mapping so the
  recommendation layer can read top-line limits without traversing the list.
- ``perfil_grupo`` + ``capital_segurado`` collapse into the canonical
  ``group`` block (collective profile).
"""

from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Any

from ai_copilot_api.db.enums import ProductCategory


def _normalize_tax_id(value: Any) -> str | None:
    if value is None:
        return None
    digits = re.sub(r"\D", "", str(value))
    return digits or None


def _parse_iso_date(value: Any) -> str | None:
    """Return an ``YYYY-MM-DD`` string or ``None``; tolerates carrier formats."""
    if value in (None, ""):
        return None
    text = str(value).strip()
    try:
        return date.fromisoformat(text[:10]).isoformat()
    except ValueError:
        return None


def _parse_calculated_at(date_str: Any, time_str: Any) -> str | None:
    """Combine ``data_impressao`` + ``hora_impressao`` into an ISO timestamp."""
    if date_str in (None, ""):
        return None
    iso_date = _parse_iso_date(date_str)
    if iso_date is None:
        return None
    if time_str in (None, ""):
        return f"{iso_date}T00:00:00"
    return f"{iso_date}T{str(time_str).strip()}"


def _compute_valid_until(reference: Any, validade_dias: Any) -> str | None:
    """Compute ``validade = data_referencia + validade_dias`` when both are set."""
    iso_ref = _parse_iso_date(reference)
    if iso_ref is None or validade_dias in (None, ""):
        return None
    try:
        days = int(validade_dias)
    except (TypeError, ValueError):
        return None
    return (date.fromisoformat(iso_ref) + timedelta(days=days)).isoformat()


def _adapt_quote(
    cotacao: dict[str, Any],
    seguradora: dict[str, Any],
    *,
    tipo_produto: Any,
    tipo_seguro: Any,
) -> dict[str, Any]:
    return {
        "number": cotacao.get("numero") or cotacao.get("id"),
        "item": 1,
        "calculated_at": _parse_calculated_at(
            cotacao.get("data_impressao"),
            cotacao.get("hora_impressao"),
        ),
        "valid_until": _compute_valid_until(
            cotacao.get("data_referencia"),
            cotacao.get("validade_dias"),
        ),
        "insurer_name": seguradora.get("nome"),
        # Tokio uses "registro_susep" as the carrier-side identifier; we map
        # it to insurer_code so the same column on Opportunity is populated
        # regardless of carrier.
        "insurer_code": seguradora.get("registro_susep"),
        "product_name": tipo_produto,
        "product_code": None,
        "insurance_type": tipo_seguro,
        "customer_type": None,
        "bonus_class": None,
    }


def _adapt_applicant(estipulante: dict[str, Any]) -> dict[str, Any]:
    return {
        "full_name": estipulante.get("razao_social"),
        "tax_id": _normalize_tax_id(estipulante.get("cnpj")),
        "person_type": "Juridica",
        "gender": None,
        "date_of_birth": None,
        "marital_status": None,
        "overnight_postal_code": None,
        "is_main_driver": None,
        "email": None,
        "phone": None,
    }


def _adapt_brokerage(corretora: dict[str, Any] | None) -> dict[str, Any] | None:
    if not corretora:
        return None
    return {
        "name": corretora.get("nome"),
        # Tokio's PME life payload only carries the corretora's broker registry,
        # not its CNPJ; we leave tax_id null (the schema allows it).
        "tax_id": None,
        "branch_code": None,
        "inspection_code": None,
        "cpd": corretora.get("codigo"),
    }


def _adapt_coverage_period(vigencia: dict[str, Any] | None) -> dict[str, Any] | None:
    if not vigencia:
        return None
    starts_at = vigencia.get("data_inicio")
    ends_at = vigencia.get("data_fim")
    if starts_at in (None, "") and ends_at in (None, ""):
        return None
    return {
        "starts_at": starts_at if starts_at else None,
        "ends_at": ends_at if ends_at else None,
    }


# Mapping from Tokio Marine pt-BR coverage codes to canonical semantic slots.
# Codes not in this map remain visible in `coverage_items` but do not
# populate the flat `coverages` decimals.
_LIFE_CODE_TO_SLOT: dict[str, str] = {
    "BASICA_MORTE": "death",
    "MORTE": "death",
    "MN": "death",  # Morte Natural
    "MORTE_ACIDENTAL": "accidental_death",
    "IEA": "accidental_death",  # Indenização Especial por Acidente
    "MA": "accidental_death",
    "IPA": "total_disability",  # Invalidez Permanente por Acidente
    "IPTA": "total_disability",
    "DG": "grave_illnesses",  # Doenças Graves
    "DOENCAS_GRAVES": "grave_illnesses",
    "AF": "funeral_assistance",  # Auxílio Funeral
    "AUXILIO_FUNERAL": "funeral_assistance",
    "DH": "daily_hospital_indemnity",
    "DIH": "daily_hospital_indemnity",
}


def _adapt_coverage_items(coberturas: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    if not coberturas:
        return []
    out: list[dict[str, Any]] = []
    for c in coberturas:
        code = c.get("codigo")
        description = c.get("descricao")
        if not code or not description:
            continue
        out.append(
            {
                "code": str(code).strip(),
                "description": str(description).strip(),
                "indemnity_percentage": c.get("percentual_indenizacao"),
                "insured_capital_min": c.get("capital_segurado_minimo"),
                "insured_capital_max": c.get("capital_segurado_maximo"),
                "premium": c.get("premio"),
                "accumulable_with_death": c.get("acumulavel_morte_acidental"),
                "note": c.get("observacao"),
            },
        )
    return out


def _flat_coverages_from_items(items: list[dict[str, Any]]) -> dict[str, Any]:
    """Roll up per-item insured capital into the flat ``coverages`` block.

    Uses ``insured_capital_min`` as the canonical "selected capital" because
    Tokio sets ``min == max`` for fixed plans; carriers that vary the band
    can still surface both extremes via ``coverage_items``.
    """
    out: dict[str, Any] = {}
    for item in items:
        code = str(item.get("code") or "").upper().strip()
        slot = _LIFE_CODE_TO_SLOT.get(code)
        if slot is None or slot in out:
            continue
        out[slot] = item.get("insured_capital_min") or item.get("insured_capital_max")
    return out


def _adapt_group(
    perfil_grupo: dict[str, Any] | None,
    capital_segurado: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if not perfil_grupo and not capital_segurado:
        return None
    perfil = perfil_grupo or {}
    capital = capital_segurado or {}

    eligible = perfil.get("grupo_segurado") or []
    return {
        "eligible_categories": [str(x) for x in eligible if x is not None],
        "adhesion_type": perfil.get("forma_adesao"),
        "funding": perfil.get("custeio"),
        "has_health_plan": perfil.get("possui_plano_saude"),
        "previous_carrier_carries_leave": perfil.get("seguradora_anterior_afastados"),
        "accepts_disability_retirees": perfil.get("aposentados_invalidez"),
        "lives_count": perfil.get("quantidade_vidas"),
        "capital_calculation_method": capital.get("forma_calculo"),
        "salary_multiplier": capital.get("multiplicador_salario"),
        "total_capital": capital.get("capital_total"),
        "note": capital.get("observacao"),
    }


def _adapt_acceptance(condicoes: dict[str, Any] | None) -> dict[str, Any] | None:
    if not condicoes:
        return None
    dps = condicoes.get("necessita_dps_ate_65") or {}
    bands = condicoes.get("limites_capital_por_faixa") or []
    bands_out: list[dict[str, Any]] = []
    if isinstance(bands, list):
        for b in bands:
            if not isinstance(b, dict):
                continue
            bands_out.append(
                {
                    "age_band": b.get("idade"),
                    "max_capital": b.get("capital_maximo"),
                },
            )
    return {
        "full_adhesion_required": condicoes.get("adesao_100_porcento_obrigatoria"),
        "max_acceptance_age": condicoes.get("idade_limite_aceitacao"),
        "medical_questionnaire_threshold_capital": dps.get("capital_limite"),
        "capital_limits_by_age_band": bands_out,
        "new_adhesions_above_65_require_proposal": condicoes.get(
            "novas_adesoes_maior_65_exigem_proposta",
        ),
    }


def _adapt_premium(precificacao: dict[str, Any] | None) -> dict[str, Any]:
    if not precificacao:
        return {}
    monthly = precificacao.get("fatura_mensal")
    total_coverages = precificacao.get("premio_total_coberturas")
    return {
        "net_premium": total_coverages,
        "iof": None,
        "total": monthly or total_coverages,
        "total_payable": monthly or total_coverages,
    }


class TokioLifeJsonAdapterV1:
    """Tokio Marine PME group-life pt-BR JSON → canonical ``LifeProposalPayload`` dict."""

    source = "tokio_life_json_v1"
    insurance_line = ProductCategory.LIFE_INSURANCE

    def to_canonical_dict(self, raw: Any) -> dict[str, Any]:
        if not isinstance(raw, dict):
            raise ValueError("Tokio Life JSON adapter expects a dict at the top level")

        body = raw.get("proposta_seguro_vida") or raw
        if not isinstance(body, dict):
            raise ValueError(
                "Tokio Life JSON adapter expects a 'proposta_seguro_vida' object",
            )

        cotacao = body.get("cotacao") or {}
        seguradora = body.get("seguradora") or {}
        coverage_items = _adapt_coverage_items(body.get("coberturas"))

        return {
            "insurance_line": ProductCategory.LIFE_INSURANCE.value,
            "quote": _adapt_quote(
                cotacao,
                seguradora,
                tipo_produto=body.get("tipo_produto"),
                tipo_seguro=body.get("tipo_seguro"),
            ),
            "applicant": _adapt_applicant(body.get("estipulante") or {}),
            "coverage_period": _adapt_coverage_period(body.get("vigencia")),
            "brokerage": _adapt_brokerage(body.get("corretora")),
            "insured": None,  # group plan: no individual insured
            "group": _adapt_group(
                body.get("perfil_grupo"),
                body.get("capital_segurado"),
            ),
            "beneficiaries_count": None,
            "coverages": _flat_coverages_from_items(coverage_items),
            "coverage_items": coverage_items,
            "acceptance_conditions": _adapt_acceptance(body.get("condicoes_aceitacao")),
            "premium": _adapt_premium(body.get("precificacao")),
            "clauses": [],
        }


__all__ = [
    "TokioLifeJsonAdapterV1",
]
