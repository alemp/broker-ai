"""Tokio Marine PME group life JSON adapter (`tokio_life_json_v1`).

Pin the adapter behaviour against a real-world Tokio Marine PME quote and
verify the canonical output validates against
:class:`LifeProposalPayload`.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from ai_copilot_api.db.enums import ProductCategory
from ai_copilot_api.domain.proposal_adapters import select_adapter_for_json
from ai_copilot_api.domain.proposal_adapters.tokio_life_json_v1 import (
    TokioLifeJsonAdapterV1,
)
from ai_copilot_api.schemas.proposal_ingest import LifeProposalPayload

TOKIO_LIFE_PAYLOAD: dict = {
    "proposta_seguro_vida": {
        "tipo_produto": "PME Vida Empresa",
        "tipo_seguro": "Novo",
        "seguradora": {
            "nome": "Tokio Marine Seguradora S.A.",
            "processo_susep": "15414.001974/2006-10",
            "registro_susep": "6190-0",
        },
        "cotacao": {
            "numero": "8845494",
            "id": "8845431",
            "ramo": "993",
            "data_referencia": "2026-02-02",
            "data_impressao": "2026-02-02",
            "data_ultima_atualizacao": "2026-02-02",
            "hora_impressao": "11:02:15",
            "validade_dias": 60,
            "aceitacao_sujeita_analise": True,
        },
        "corretora": {
            "codigo": "061818",
            "nome": "CASUS CONSULTORIA E CORRETAGEM DE SEGUROS LTDA ME",
            "registro_susep": "222138989",
            "telefone": "21 92972655",
        },
        "estipulante": {
            "razao_social": "GRDL ENGENHARIA, CONSULTORIAS E REFORMAS LTDA",
            "cnpj": "46.260.876/0001-78",
            "atividade": "SERVIÇOS DE PINTURA DE EDIFICIOS EM GERAL",
            "cnae": "4330404",
        },
        "perfil_grupo": {
            "grupo_segurado": [
                "Sócios",
                "Diretores",
                "Funcionários",
                "Estagiários",
                "Jovens aprendizes",
                "Prestadores de serviço com contrato de trabalho exclusivo",
            ],
            "forma_adesao": "Compulsória",
            "custeio": "Não Contributário",
            "possui_plano_saude": True,
            "seguradora_anterior_afastados": False,
            "aposentados_invalidez": False,
            "quantidade_vidas": 2,
        },
        "capital_segurado": {
            "forma_calculo": "Múltiplo Salarial",
            "multiplicador_salario": 10,
            "observacao": "O Capital Segurado será Múltiplo Salarial (10 vezes o salário).",
            "capital_total": 30000.00,
        },
        "coberturas": [
            {
                "codigo": "BASICA_MORTE",
                "descricao": "Morte",
                "percentual_indenizacao": 100.0,
                "capital_segurado_minimo": 15000.00,
                "capital_segurado_maximo": 15000.00,
                "premio": 19.28,
            },
            {
                "codigo": "IEA",
                "descricao": "Indenização Especial por Acidente",
                "percentual_indenizacao": 100.0,
                "capital_segurado_minimo": 15000.00,
                "capital_segurado_maximo": 15000.00,
                "premio": 10.52,
                "acumulavel_morte_acidental": True,
            },
            {
                "codigo": "IPA",
                "descricao": "Invalidez Permanente Total ou Parcial por Acidente",
                "percentual_indenizacao": 100.0,
                "capital_segurado_minimo": 15000.00,
                "capital_segurado_maximo": 15000.00,
                "premio": 1.88,
                "observacao": (
                    "O valor demonstrado refere-se à invalidez total; "
                    "invalidez parcial segue tabela percentual das condições gerais."
                ),
            },
        ],
        "precificacao": {
            "premio_minimo_estipulante": 50.00,
            "taxa_media_mensal_por_mil": 1.0560,
            "fatura_mensal": 31.68,
            "premio_total_coberturas": 31.68,
        },
        "condicoes_aceitacao": {
            "adesao_100_porcento_obrigatoria": True,
            "idade_limite_aceitacao": 75,
            "necessita_dps_ate_65": {
                "capital_limite": 200000.00,
            },
            "limites_capital_por_faixa": [
                {"idade": "até 65 anos", "capital_maximo": 300000.00},
                {"idade": "66 a 70 anos", "capital_maximo": 75000.00},
                {"idade": "71 a 75 anos", "capital_maximo": 50000.00},
            ],
            "novas_adesoes_maior_65_exigem_proposta": True,
        },
        "vigencia": {
            "prazo_meses": 12,
            "renovacao_automatica": True,
            "quantidade_renovacoes_automaticas": 1,
            "aviso_previo_nao_renovacao_dias": 60,
            "data_inicio": None,
            "data_fim": None,
        },
        "metadados_documento": {
            "documento": "Cotação Seguro de AP Funcionários 2026",
            "folhas": 3,
            "data_certificacao": "2026-02-02T11:02:15-0300",
        },
    },
}


# ---------------------------------------------------------------------------
# Selector wiring
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("source", ["tokio_life_json_v1", "tokio_life_v1", "TOKIO_LIFE_V1"])
def test_select_adapter_for_json_returns_tokio_life(source: str) -> None:
    adapter = select_adapter_for_json(source)
    assert isinstance(adapter, TokioLifeJsonAdapterV1)
    assert adapter.source == "tokio_life_json_v1"
    assert adapter.insurance_line == ProductCategory.LIFE_INSURANCE


# ---------------------------------------------------------------------------
# Canonical translation
# ---------------------------------------------------------------------------


def test_adapter_returns_canonical_dict_for_tokio_pme() -> None:
    canonical = TokioLifeJsonAdapterV1().to_canonical_dict(TOKIO_LIFE_PAYLOAD)

    # quote
    quote = canonical["quote"]
    assert quote["number"] == "8845494"
    assert quote["insurer_name"] == "Tokio Marine Seguradora S.A."
    assert quote["insurer_code"] == "6190-0"
    assert quote["product_name"] == "PME Vida Empresa"
    assert quote["insurance_type"] == "Novo"
    assert quote["calculated_at"] == "2026-02-02T11:02:15"
    # 2026-02-02 + 60 days = 2026-04-03
    assert quote["valid_until"] == "2026-04-03"

    # applicant (estipulante = company)
    applicant = canonical["applicant"]
    assert applicant["full_name"] == "GRDL ENGENHARIA, CONSULTORIAS E REFORMAS LTDA"
    assert applicant["tax_id"] == "46260876000178"
    assert applicant["person_type"] == "Juridica"

    # brokerage
    brokerage = canonical["brokerage"]
    assert brokerage is not None
    assert brokerage["name"] == "CASUS CONSULTORIA E CORRETAGEM DE SEGUROS LTDA ME"
    assert brokerage["cpd"] == "061818"

    # group/PME profile
    group = canonical["group"]
    assert group is not None
    assert group["adhesion_type"] == "Compulsória"
    assert group["funding"] == "Não Contributário"
    assert group["lives_count"] == 2
    assert group["has_health_plan"] is True
    assert group["accepts_disability_retirees"] is False
    assert "Funcionários" in group["eligible_categories"]
    assert group["capital_calculation_method"] == "Múltiplo Salarial"
    assert group["salary_multiplier"] == 10
    assert group["total_capital"] == 30000.00

    # individual insured is null for group plans
    assert canonical["insured"] is None

    # coverage items
    items = canonical["coverage_items"]
    assert isinstance(items, list)
    assert [i["code"] for i in items] == ["BASICA_MORTE", "IEA", "IPA"]
    death_item = items[0]
    assert death_item["description"] == "Morte"
    assert death_item["insured_capital_min"] == 15000.00
    assert death_item["premium"] == 19.28

    # flat coverages rolled up from items
    flat = canonical["coverages"]
    assert flat == {
        "death": 15000.00,
        "accidental_death": 15000.00,
        "total_disability": 15000.00,
    }

    # acceptance conditions
    acc = canonical["acceptance_conditions"]
    assert acc is not None
    assert acc["full_adhesion_required"] is True
    assert acc["max_acceptance_age"] == 75
    assert acc["medical_questionnaire_threshold_capital"] == 200000.00
    bands = acc["capital_limits_by_age_band"]
    assert len(bands) == 3
    assert bands[0] == {"age_band": "até 65 anos", "max_capital": 300000.00}

    # premium
    premium = canonical["premium"]
    assert premium["total_payable"] == 31.68
    assert premium["total"] == 31.68
    assert premium["net_premium"] == 31.68

    # coverage_period (vigencia has only nullable fields → coalesce to None)
    assert canonical["coverage_period"] is None

    # clauses (Tokio PME doesn't expose carrier-coded clause list)
    assert canonical["clauses"] == []


# ---------------------------------------------------------------------------
# Pydantic round-trip
# ---------------------------------------------------------------------------


def test_canonical_output_validates_against_life_payload() -> None:
    canonical = TokioLifeJsonAdapterV1().to_canonical_dict(TOKIO_LIFE_PAYLOAD)
    payload = LifeProposalPayload.model_validate(canonical)

    assert payload.insurance_line == ProductCategory.LIFE_INSURANCE
    assert payload.quote.number == "8845494"
    assert payload.applicant.full_name.startswith("GRDL ENGENHARIA")
    assert payload.applicant.tax_id == "46260876000178"
    assert payload.insured is None
    assert payload.group is not None
    assert payload.group.lives_count == 2
    assert payload.coverages.death == Decimal("15000.00")
    assert payload.coverages.accidental_death == Decimal("15000.00")
    assert payload.coverages.total_disability == Decimal("15000.00")
    assert len(payload.coverage_items) == 3
    assert payload.coverage_items[0].code == "BASICA_MORTE"
    assert payload.coverage_items[1].accumulable_with_death is True
    assert payload.acceptance_conditions is not None
    assert payload.acceptance_conditions.max_acceptance_age == 75
    assert payload.premium.total_payable == Decimal("31.68")


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


def test_adapter_accepts_unwrapped_body() -> None:
    """Caller may submit the inner object directly (without the carrier wrapper)."""
    inner = TOKIO_LIFE_PAYLOAD["proposta_seguro_vida"]
    canonical = TokioLifeJsonAdapterV1().to_canonical_dict(inner)
    LifeProposalPayload.model_validate(canonical)


def test_adapter_rejects_non_dict_root() -> None:
    with pytest.raises(ValueError, match="dict"):
        TokioLifeJsonAdapterV1().to_canonical_dict([1, 2, 3])  # type: ignore[arg-type]


def test_adapter_handles_missing_optional_blocks() -> None:
    """Group plan without `precificacao` / `condicoes_aceitacao` still validates."""
    minimal: dict = {
        "proposta_seguro_vida": {
            "tipo_produto": "PME Vida Empresa",
            "tipo_seguro": "Novo",
            "seguradora": {"nome": "Tokio Marine Seguradora S.A."},
            "cotacao": {"numero": "TEST-MIN", "data_referencia": "2026-02-02"},
            "estipulante": {
                "razao_social": "ACME LTDA",
                "cnpj": "11.222.333/0001-44",
            },
            "perfil_grupo": {"quantidade_vidas": 5},
            "capital_segurado": {"capital_total": 50000.00},
            "coberturas": [
                {
                    "codigo": "BASICA_MORTE",
                    "descricao": "Morte",
                    "capital_segurado_minimo": 10000.00,
                },
            ],
        },
    }
    canonical = TokioLifeJsonAdapterV1().to_canonical_dict(minimal)
    payload = LifeProposalPayload.model_validate(canonical)
    assert payload.acceptance_conditions is None
    assert payload.premium.total_payable is None
    assert payload.coverages.death == Decimal("10000.00")


def test_adapter_skips_unknown_coverage_codes_for_flat_block() -> None:
    canonical = TokioLifeJsonAdapterV1().to_canonical_dict(
        {
            "proposta_seguro_vida": {
                "seguradora": {"nome": "Tokio Marine Seguradora S.A."},
                "cotacao": {"numero": "TEST-UNK"},
                "estipulante": {"razao_social": "X LTDA", "cnpj": "11.222.333/0001-44"},
                "coberturas": [
                    {
                        "codigo": "UNKNOWN_CODE",
                        "descricao": "Cobertura desconhecida",
                        "capital_segurado_minimo": 5000.0,
                    },
                ],
            },
        },
    )
    # Item is preserved, but flat coverages stays empty.
    assert canonical["coverages"] == {}
    assert len(canonical["coverage_items"]) == 1
    assert canonical["coverage_items"][0]["code"] == "UNKNOWN_CODE"
