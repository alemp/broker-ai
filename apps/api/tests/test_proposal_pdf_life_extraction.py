"""Tokio Marine PME Vida PDF text extraction → canonical ``LifeProposalPayload``."""

from __future__ import annotations

from ai_copilot_api.domain.proposal_adapters.tokio_life_pdf_v1 import TokioLifePdfAdapterV1
from ai_copilot_api.domain.proposal_pdf_life_extraction import extract_tokio_life_pme_proposal
from ai_copilot_api.schemas.proposal_ingest import LifeProposalPayload


def _synthetic_tokio_pme_pdf_text() -> str:
    """Flattened labels similar to pypdf output from a Tokio PME vida cotação."""
    return """
TOKIO MARINE SEGURADORA S.A.
PME Vida Empresa
Cotação Nº 8845494
Validade da cotação 60 dias
02/02/2026 11:02:15

Razão Social
GRDL ENGENHARIA, CONSULTORIAS E REFORMAS LTDA
CNPJ 46.260.876/0001-78

Quantidade de vidas 2
Forma de adesão Compulsória
Custeio Não Contributário
Possui plano de saúde Sim
Múltiplo Salarial 10
Capital total 30.000,00

Fatura mensal 31,68
Prêmio total coberturas 31,68

Código corretora 061818
Nome corretora CASUS CONSULTORIA E CORRETAGEM DE SEGUROS LTDA ME

BASICA_MORTE Morte 15.000,00 15.000,00 19,28
IEA Indenização Especial por Acidente 15.000,00 15.000,00 10,52
"""


def test_extract_tokio_life_pme_from_synthetic_pdf_text() -> None:
    raw = _synthetic_tokio_pme_pdf_text()
    compact = " ".join(raw.split())
    ext = extract_tokio_life_pme_proposal(raw, compact)
    assert ext.tokio_inner["cotacao"]["numero"] == "8845494"
    assert ext.tokio_inner["estipulante"]["razao_social"] is not None
    cnpj_raw = ext.tokio_inner["estipulante"].get("cnpj") or ""
    assert "46260876" in cnpj_raw.replace(".", "").replace("/", "").replace("-", "")
    assert len(ext.tokio_inner["coberturas"]) >= 2
    assert ext.confidence >= 70
    assert ext.requires_review is False


def test_tokio_life_pdf_adapter_validates_as_life_payload() -> None:
    raw = _synthetic_tokio_pme_pdf_text()
    compact = " ".join(raw.split())
    adapter = TokioLifePdfAdapterV1()
    canonical = adapter.to_canonical_dict({"compact_text": compact, "raw_text": raw})
    payload = LifeProposalPayload.model_validate(canonical)
    assert payload.quote.number == "8845494"
    assert payload.quote.insurer_name
    assert payload.applicant.full_name.startswith("GRDL")
    assert payload.applicant.tax_id == "46260876000178"
    assert len(payload.coverage_items) >= 2
    assert adapter.last_pdf_extraction is not None
    assert adapter.last_pdf_extraction.confidence >= 70


def test_non_tokio_text_yields_empty_extraction() -> None:
    raw = "Bradesco Seguro Auto\nCotação 12345"
    compact = " ".join(raw.split())
    ext = extract_tokio_life_pme_proposal(raw, compact)
    assert ext.tokio_inner == {}
    assert ext.confidence == 0
