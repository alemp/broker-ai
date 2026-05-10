"""Non-regression tests for the Bradesco "Demonstrativo de Cálculo" PDF layout.

The DC layout uses column-block formatting — pypdf serializes labels first
and values after, so the field-on-same-line regexes used for the simpler
"proposta single-line" layout never match.

These tests pin the extractor against a representative DC text so future
refactors cannot silently regress the production carrier flow.
"""

# ruff: noqa: E501 — fixture preserves the carrier text exactly as pypdf emits it.
from __future__ import annotations

from textwrap import dedent

from ai_copilot_api.domain.proposal_adapters.bradesco_json_v1 import (
    BradescoAutoJsonAdapterV1,
)
from ai_copilot_api.domain.proposal_pdf_extraction import extract_auto_proposal

# Minimal slice of the real Bradesco DC text for one of our partner brokers,
# captured from a production PDF and edited only to remove unrelated noise.
_DC_TEXT = dedent(
    """\
    Versão:
    15/04/2026Nº Cotação:
    DEMONSTRATIVO DE CÁLCULO
    15/04/2026 09:29:3702 Data / Hora:
    92.682.038/0001-00
    15.414.900666/2014-89

    8000
    Estudo:
    0796428117/02
    Bradesco Auto/Re Companhia de Seguros
    Usuário :
    Cálculo válido até:Processo SUSEP:
    CNPJ: Data do 1º Cálculo:
    22/04/2026
    0000
    1Item:
    DADOS DO SEGURODADOS DO PROPONENTE
    Nome:
    CPF/CNPJ:
    Tipo Pessoa:
    Sexo:
    Data Nasc.:
    Estado Civil:
    CEP de Pernoite:
    Tipo Seguro:
    Vigência:
    Cód. Contrato:
    Tipo Cliente:
    Bônus:
    Cia Renovação:
    Sinistro? Quant.:
    ELIAS GONCALVES SABOIA
    887.290.447-15
    Física
    Masculino
    09/01/1967
    Casado/União Estável
    das 24h de 20/04/2026 às 24h de 20/04/2027
    544
    Individual
    00000000000
    20261-243
    10
    Não 00
    Produto: 1585 - BRADESCO SEGURO AUTO PRIME
    Segurado é o principal condutor ? Sim
    DADOS DO CORRETOR
    Nome: COREAUTO CORRETORA DE SEGUROS LTDA
    Sucursal: 445
    Inspetoria: 18
    CPD: 419312 - 1000
    CPF/CNPJ: 10.263.942/0001-16
    OBJETO DO SEGURO
    Tipo do Veículo:
    Marca:
    Uso Veículo:
    Equipamentos:
    Ano Fab.:
    Código:
    Chassi:
    Ano Mod.:
    Placa:
    Chassi Remarcado:
    Código FIPE:
    Zero KM:
    Isenção Fiscal:
    Nº Portas:
    Data Saída Conc.:
    Nº Eixos:
    Acessórios:
    Antifurto:
    Veíc. Transformado:
    Tipo Semi-Reb.:
    Carroceria:
    Compass Limited 2.0 4x2 Flex 1
    JEEP
    Particular
    Não
    2017
    11588
    2017
    988675134HKH20740
    KXK7802
    Não
    0170470
    Não
    Não
    04
    02
    Não
    Não
    Não
    Não
    Não
    CLÁUSULAS
    (001) Cobertura Compreensiva (106) Assist Auto Prime Dia/Noite - Passeio
    Ilimitado (157) Despesas Médicas e Hospitalares
    (115) Auto Reserva Plus - 15 dias (038) Valor mercado referenciado (056) Danos Morais
    (006) Extensão perímetro Mercosul (081) Acidentes Pessoais de Passageiros (024) Vidro Protegido Plus
    Página 1 de 5
    Total a pagar R$ 3.658,17
    """,
)


def test_dc_layout_extracts_quote_from_estudo_anchor() -> None:
    extracted = extract_auto_proposal(_DC_TEXT, _DC_TEXT)
    assert extracted.confidence >= 70
    quote = extracted.raw.get("cotacao")
    assert isinstance(quote, dict)
    # Without the Estudo anchor the legacy regex would match "DEMONSTRATIVO"
    # right after "Nº Cotação:" — guard against that regression.
    assert quote.get("numero") == "0796428117/02"
    assert quote.get("seguradora") == "Bradesco Auto/Re Companhia de Seguros"
    produto = quote.get("produto")
    assert isinstance(produto, dict)
    assert produto.get("nome") == "BRADESCO SEGURO AUTO PRIME"
    assert quote.get("tipo_cliente") == "Individual"


def test_dc_layout_extracts_proponent_block_fallback() -> None:
    extracted = extract_auto_proposal(_DC_TEXT, _DC_TEXT)
    proponente = extracted.raw.get("proponente")
    assert isinstance(proponente, dict)
    assert proponente.get("nome") == "ELIAS GONCALVES SABOIA"
    assert proponente.get("cpf_cnpj") == "887.290.447-15"
    # tipo_pessoa must prefer CPF presence over the broker/insurer CNPJs above.
    assert proponente.get("tipo_pessoa") == "Fisica"


def test_dc_layout_extracts_vehicle_block() -> None:
    extracted = extract_auto_proposal(_DC_TEXT, _DC_TEXT)
    vehicle = extracted.raw.get("veiculo")
    assert isinstance(vehicle, dict)
    assert vehicle.get("marca") == "JEEP"
    assert vehicle.get("modelo") == "Compass Limited 2.0 4x2 Flex 1"
    assert vehicle.get("placa") == "KXK7802"
    assert vehicle.get("chassi") == "988675134HKH20740"
    assert vehicle.get("codigo_fipe") == "0170470"
    assert vehicle.get("ano_fabricacao") == 2017
    assert vehicle.get("ano_modelo") == 2017


def test_dc_layout_extracts_inline_clauses() -> None:
    extracted = extract_auto_proposal(_DC_TEXT, _DC_TEXT)
    clauses = extracted.raw.get("clausulas")
    assert isinstance(clauses, list)
    codes = [c["codigo"] for c in clauses]
    # All 9 carrier-coded clauses present in the DC paragraph.
    assert codes == ["001", "106", "157", "115", "038", "056", "006", "081", "024"]
    # The 544 / "Individual" pair (which are Cód. Contrato + Tipo Cliente
    # values, not clauses) must not leak into the list.
    assert "544" not in codes
    by_code = {c["codigo"]: c["descricao"] for c in clauses}
    assert by_code["001"] == "Cobertura Compreensiva"
    assert by_code["006"] == "Extensão perímetro Mercosul"


def test_dc_layout_round_trip_to_canonical_payload() -> None:
    """The DC extraction must round-trip cleanly through the JSON adapter."""
    from ai_copilot_api.schemas.proposal_ingest import AutoProposalPayload

    extracted = extract_auto_proposal(_DC_TEXT, _DC_TEXT)
    canonical = BradescoAutoJsonAdapterV1().to_canonical_dict(extracted.raw)
    payload = AutoProposalPayload.model_validate(canonical)

    assert payload.quote.number == "0796428117/02"
    assert payload.quote.insurer_name == "Bradesco Auto/Re Companhia de Seguros"
    assert payload.applicant.full_name == "ELIAS GONCALVES SABOIA"
    assert payload.applicant.tax_id == "88729044715"
    assert payload.applicant.person_type == "Fisica"
    assert payload.vehicle.make == "JEEP"
    assert payload.vehicle.model == "Compass Limited 2.0 4x2 Flex 1"
    assert payload.vehicle.plate == "KXK7802"
    assert payload.vehicle.chassis == "988675134HKH20740"
    assert payload.vehicle.fipe_code == "0170470"
    assert payload.vehicle.fabrication_year == 2017
    assert payload.vehicle.model_year == 2017
    assert [c.code for c in payload.clauses] == [
        "001",
        "106",
        "157",
        "115",
        "038",
        "056",
        "006",
        "081",
        "024",
    ]
