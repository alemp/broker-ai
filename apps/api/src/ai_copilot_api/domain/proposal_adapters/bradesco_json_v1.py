"""Adapter: Bradesco Auto/RE quotation JSON (pt-BR keys) → canonical schema.

The carrier emits Portuguese-keyed payloads. This adapter translates them
into the English `AutoProposalPayload` shape (returned as dict so that the
single Pydantic validation pass at the API boundary remains the only gate).

Reference shape (excerpt) — `cotacao`, `proponente`, `vigencia`, `corretor`,
`veiculo`, `questionario_risco`, `coberturas`, `franquias`, `premio`,
`clausulas` — is documented in `docs/ADR-PROPOSAL-INGEST.md`.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from ai_copilot_api.db.enums import ProductCategory


def _normalize_tax_id(value: Any) -> str | None:
    if value is None:
        return None
    digits = re.sub(r"\D", "", str(value))
    return digits or None


def _coerce_iso_datetime(value: Any) -> str | None:
    """Carrier uses `T24:00:00` to mean midnight of the next day; coerce it."""
    if value in (None, ""):
        return None
    text = str(value).strip()
    if text.endswith("T24:00:00"):
        base = datetime.fromisoformat(text.replace("T24:00:00", "T00:00:00"))
        return base.replace(hour=0, minute=0, second=0).isoformat()
    return text


def _combine_calculated_at(date_str: Any, time_str: Any) -> str | None:
    if date_str in (None, ""):
        return None
    if time_str in (None, ""):
        return f"{date_str}T00:00:00"
    return f"{date_str}T{time_str}"


def _adapt_quote(cotacao: dict[str, Any]) -> dict[str, Any]:
    produto = cotacao.get("produto") or {}
    sinistro = cotacao.get("sinistro") or {}
    return {
        "number": cotacao.get("numero"),
        "item": cotacao.get("item") or 1,
        "calculated_at": _combine_calculated_at(
            cotacao.get("data_calculo"),
            cotacao.get("hora_calculo"),
        ),
        "valid_until": cotacao.get("validade"),
        "insurer_name": cotacao.get("seguradora"),
        "insurer_code": cotacao.get("codigo_contrato"),
        "product_name": produto.get("nome"),
        "product_code": produto.get("codigo"),
        "insurance_type": cotacao.get("tipo_seguro"),
        "customer_type": cotacao.get("tipo_cliente"),
        "bonus_class": cotacao.get("bonus"),
        "has_claims": sinistro.get("houve"),
        "claims_count": sinistro.get("quantidade"),
    }


def _adapt_applicant(proponente: dict[str, Any]) -> dict[str, Any]:
    return {
        "full_name": proponente.get("nome"),
        "tax_id": _normalize_tax_id(proponente.get("cpf_cnpj")),
        "person_type": proponente.get("tipo_pessoa"),
        "gender": proponente.get("sexo"),
        "date_of_birth": proponente.get("data_nascimento"),
        "marital_status": proponente.get("estado_civil"),
        "overnight_postal_code": proponente.get("cep_pernoite"),
        "is_main_driver": proponente.get("principal_condutor"),
        "email": proponente.get("email"),
        "phone": proponente.get("telefone"),
    }


def _adapt_coverage_period(vigencia: dict[str, Any] | None) -> dict[str, Any] | None:
    if not vigencia:
        return None
    return {
        "starts_at": _coerce_iso_datetime(vigencia.get("inicio")),
        "ends_at": _coerce_iso_datetime(vigencia.get("fim")),
    }


def _adapt_brokerage(corretor: dict[str, Any] | None) -> dict[str, Any] | None:
    if not corretor:
        return None
    return {
        "name": corretor.get("nome"),
        "tax_id": _normalize_tax_id(corretor.get("cnpj")),
        "branch_code": corretor.get("sucursal"),
        "inspection_code": corretor.get("inspetoria"),
        "cpd": corretor.get("cpd"),
    }


def _adapt_vehicle(veiculo: dict[str, Any]) -> dict[str, Any]:
    return {
        "make": veiculo.get("marca"),
        "model": veiculo.get("modelo"),
        "version": veiculo.get("versao"),
        "fabrication_year": veiculo.get("ano_fabricacao"),
        "model_year": veiculo.get("ano_modelo"),
        "vehicle_code": veiculo.get("codigo_veiculo"),
        "plate": veiculo.get("placa"),
        "chassis": veiculo.get("chassi"),
        "fipe_code": veiculo.get("codigo_fipe"),
        "usage": veiculo.get("uso"),
        "zero_km": veiculo.get("zero_km"),
        "tax_exempt": veiculo.get("isencao_fiscal"),
        "door_count": veiculo.get("numero_portas"),
        "axle_count": veiculo.get("numero_eixos"),
        "chassis_reissued": veiculo.get("chassi_remarcado"),
        "transformed": veiculo.get("transformado"),
        "has_anti_theft": veiculo.get("antifurto"),
        "has_equipment": veiculo.get("equipamentos"),
        "has_accessories": veiculo.get("acessorios"),
        "semi_trailer": veiculo.get("semi_reboque"),
        "body_type": veiculo.get("carroceria"),
        "fuel_type": veiculo.get("combustivel"),
    }


def _adapt_risk_questionnaire(qr: dict[str, Any] | None) -> dict[str, Any] | None:
    if not qr:
        return None
    main = qr.get("principal_condutor") or {}
    main_driver: dict[str, Any] | None = None
    if main.get("nome") or main.get("cpf"):
        main_driver = {
            "full_name": main.get("nome"),
            "tax_id": _normalize_tax_id(main.get("cpf") or main.get("cpf_cnpj")),
            "gender": main.get("sexo"),
            "date_of_birth": main.get("data_nascimento"),
            "marital_status": main.get("estado_civil"),
        }
    km = qr.get("quilometragem_media") or {}
    return {
        "main_driver": main_driver,
        "young_driver_18_25": qr.get("condutor_18_25_anos"),
        "average_mileage": {
            "description": km.get("descricao"),
            "band": km.get("faixa"),
        }
        if km
        else None,
    }


def _adapt_coverages(cov: dict[str, Any]) -> dict[str, Any]:
    rc = cov.get("responsabilidade_civil") or {}
    app = cov.get("app") or {}
    casco = cov.get("tipo_casco") or {}
    assist = cov.get("assistencia_24h") or {}
    courtesy = cov.get("carro_reserva") or {}
    glass = cov.get("vidros") or {}
    return {
        "hull_valuation": {
            "description": casco.get("descricao"),
            "adjustment_percentage": casco.get("fator_ajuste_percentual"),
        }
        if casco
        else None,
        "comprehensive": cov.get("compreensiva"),
        "mercosur_extension": cov.get("mercosul"),
        "assistance_24h": {
            "name": assist.get("nome"),
            "limit": assist.get("limite"),
        }
        if assist
        else None,
        "courtesy_car": {
            "days": courtesy.get("dias"),
            "type": courtesy.get("tipo"),
        }
        if courtesy
        else None,
        "glass": {"coverage": glass.get("cobertura")} if glass else None,
        "civil_liability": {
            "material_damage": rc.get("danos_materiais"),
            "bodily_injury": rc.get("danos_corporais"),
            "moral_damages": rc.get("danos_morais"),
        }
        if rc
        else None,
        "accidental_passengers": {
            "death_per_passenger": app.get("morte_por_passageiro"),
            "disability_per_passenger": app.get("invalidez_por_passageiro"),
            "medical_expenses": app.get("despesas_medicas_hospitalares"),
            "official_capacity": app.get("lotacao_oficial"),
        }
        if app
        else None,
        "extraordinary_expenses": cov.get("despesas_extraordinarias"),
        "armor_coverage": cov.get("blindagem"),
        "gas_kit": cov.get("kit_gas"),
        "interior_goods": cov.get("bens_no_interior"),
        "daily_immobilization": cov.get("diarias_paralisacao"),
    }


def _adapt_deductibles(franquias: dict[str, Any] | None) -> dict[str, Any] | None:
    if not franquias:
        return None
    casco = franquias.get("casco") or {}
    return {
        "hull_value": casco.get("valor"),
        "hull_type": casco.get("tipo"),
        "windshield": franquias.get("parabrisa"),
        "side_glasses": franquias.get("vidros_laterais"),
        "rear_glass": franquias.get("vidro_traseiro"),
        "tail_lights": franquias.get("lanternas"),
        "led_tail_lights": franquias.get("lanternas_led"),
        "headlights": franquias.get("farois"),
        "xenon_headlights": franquias.get("farois_xenon"),
        "led_headlights": franquias.get("farois_led"),
        "side_mirrors": franquias.get("retrovisores"),
        "window_motors": franquias.get("maquina_vidros"),
    }


def _adapt_premium(premio: dict[str, Any] | None) -> dict[str, Any]:
    if not premio:
        return {}
    return {
        "net_premium": premio.get("liquido"),
        "iof": premio.get("iof"),
        "total": premio.get("total"),
        "total_payable": premio.get("total_pagar") or premio.get("total"),
    }


def _adapt_clauses(clausulas: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    if not clausulas:
        return []
    out: list[dict[str, Any]] = []
    for c in clausulas:
        code = c.get("codigo")
        description = c.get("descricao")
        if code and description:
            out.append({"code": str(code), "description": str(description)})
    return out


class BradescoAutoJsonAdapterV1:
    """Bradesco Auto/RE pt-BR JSON → canonical `AutoProposalPayload` dict."""

    source = "bradesco_json_v1"
    insurance_line = ProductCategory.AUTO_INSURANCE

    def to_canonical_dict(self, raw: Any) -> dict[str, Any]:
        if not isinstance(raw, dict):
            raise ValueError("Bradesco JSON adapter expects a dict at the top level")

        cotacao = raw.get("cotacao") or {}
        proponente = raw.get("proponente") or {}
        veiculo = raw.get("veiculo") or {}

        return {
            "insurance_line": ProductCategory.AUTO_INSURANCE.value,
            "quote": _adapt_quote(cotacao),
            "applicant": _adapt_applicant(proponente),
            "coverage_period": _adapt_coverage_period(raw.get("vigencia")),
            "brokerage": _adapt_brokerage(raw.get("corretor")),
            "vehicle": _adapt_vehicle(veiculo),
            "risk_questionnaire": _adapt_risk_questionnaire(raw.get("questionario_risco")),
            "coverages": _adapt_coverages(raw.get("coberturas") or {}),
            "deductibles": _adapt_deductibles(raw.get("franquias")),
            "premium": _adapt_premium(raw.get("premio")),
            "clauses": _adapt_clauses(raw.get("clausulas")),
        }
