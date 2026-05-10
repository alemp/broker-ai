"""Phase 2 — proposal ingest (PDF channel + canonical Pydantic + adapters)."""

from __future__ import annotations

import io
import os
import uuid

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL is required for proposal ingest integration tests",
)


def _register(client: TestClient) -> str:
    email = f"prop-{uuid.uuid4().hex}@example.com"
    password = "longpassword123"
    reg = client.post(
        "/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Proposal Tester"},
    )
    assert reg.status_code == 200, reg.text
    return reg.json()["access_token"]


def _build_proposal_pdf(text_lines: list[str]) -> bytes:
    """Hand-rolled minimal PDF whose pypdf can extract `text_lines` verbatim."""
    text_stream_lines: list[str] = ["BT", "/F1 10 Tf", "72 770 Td"]
    for idx, line in enumerate(text_lines):
        if idx > 0:
            text_stream_lines.append("0 -14 Td")
        escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        text_stream_lines.append(f"({escaped}) Tj")
    text_stream_lines.append("ET")
    text_stream = "\n".join(text_stream_lines)
    stream_bytes = text_stream.encode("latin-1")

    parts: list[bytes] = []
    offsets: list[int] = []

    def add(obj_bytes: bytes) -> None:
        offsets.append(sum(len(p) for p in parts))
        parts.append(obj_bytes)

    parts.append(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")

    add(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    add(b"2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n")
    add(
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    )
    stream_obj = (
        f"4 0 obj\n<< /Length {len(stream_bytes)} >>\nstream\n".encode("latin-1")
        + stream_bytes
        + b"\nendstream\nendobj\n"
    )
    add(stream_obj)
    add(b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")

    body = b"".join(parts)
    xref_offset = len(body)
    xref_lines = [b"xref", b"0 6", b"0000000000 65535 f "]
    for off in offsets:
        xref_lines.append(f"{off:010d} 00000 n ".encode("latin-1"))
    xref = b"\n".join(xref_lines) + b"\n"
    trailer = (
        b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n"
        + str(xref_offset).encode("latin-1")
        + b"\n%%EOF\n"
    )
    return body + xref + trailer


def test_bradesco_json_adapter_maps_canonical_fields() -> None:
    from ai_copilot_api.domain.proposal_adapters.bradesco_json_v1 import (
        BradescoAutoJsonAdapterV1,
    )
    from ai_copilot_api.schemas.proposal_ingest import AutoProposalPayload

    raw = {
        "cotacao": {
            "numero": "0796428117/02",
            "data_calculo": "2026-04-15",
            "hora_calculo": "09:29:37",
            "validade": "2026-04-22",
            "item": 1,
            "seguradora": "Bradesco Auto/RE Companhia de Seguros",
            "produto": {"codigo": "1585", "nome": "BRADESCO SEGURO AUTO PRIME"},
            "tipo_seguro": None,
            "tipo_cliente": "Individual",
            "codigo_contrato": "544",
            "bonus": 10,
            "sinistro": {"houve": False, "quantidade": 0},
        },
        "proponente": {
            "nome": "ELIAS GONCALVES SABOIA",
            "cpf_cnpj": "887.290.447-15",
            "tipo_pessoa": "Fisica",
            "sexo": "Masculino",
            "data_nascimento": "1967-01-09",
            "estado_civil": "Casado/União Estável",
            "cep_pernoite": "20261-243",
            "principal_condutor": True,
            "email": None,
            "telefone": None,
        },
        "vigencia": {
            "inicio": "2026-04-20T00:00:00",
            "fim": "2027-04-20T24:00:00",
        },
        "corretor": {
            "nome": "COREAUTO CORRETORA DE SEGUROS LTDA",
            "cnpj": "10.263.942/0001-16",
            "sucursal": "445",
            "inspetoria": "18",
            "cpd": "419312 - 1000",
        },
        "veiculo": {
            "marca": "JEEP",
            "modelo": "Compass Limited 2.0 4x2 Flex",
            "ano_fabricacao": 2017,
            "ano_modelo": 2017,
            "placa": "KXK7802",
            "chassi": "988675134HKH20740",
            "codigo_fipe": "0170470",
            "uso": "Particular",
            "combustivel": "Flex",
        },
        "questionario_risco": {
            "principal_condutor": {
                "nome": "ELIAS GONCALVES SABOIA",
                "cpf": "887.290.447-15",
            },
            "condutor_18_25_anos": False,
            "quilometragem_media": {
                "descricao": "ATE 15 KM/DIA OU ATE 500 KM/MES",
                "faixa": "ate_500_km_mes",
            },
        },
        "coberturas": {
            "tipo_casco": {
                "descricao": "Valor de Mercado Referenciado",
                "fator_ajuste_percentual": 100,
            },
            "compreensiva": True,
            "mercosul": True,
            "responsabilidade_civil": {
                "danos_materiais": 300000.0,
                "danos_corporais": 200000.0,
                "danos_morais": 5000.0,
            },
            "app": {
                "morte_por_passageiro": 5000.0,
                "invalidez_por_passageiro": 5000.0,
                "despesas_medicas_hospitalares": 5000.0,
                "lotacao_oficial": 5,
            },
        },
        "franquias": {"casco": {"valor": 4800.94, "tipo": "Reduzida"}},
        "premio": {
            "liquido": 3406.74,
            "iof": 264.64,
            "total": 3658.17,
            "total_pagar": 3658.17,
        },
        "clausulas": [
            {"codigo": "001", "descricao": "Cobertura Compreensiva"},
            {"codigo": "106", "descricao": "Assist Auto Prime Dia/Noite - Passeio"},
        ],
    }

    canonical_dict = BradescoAutoJsonAdapterV1().to_canonical_dict(raw)
    payload = AutoProposalPayload.model_validate(canonical_dict)
    assert payload.quote.number == "0796428117/02"
    assert payload.quote.insurer_name.startswith("Bradesco Auto")
    assert payload.applicant.tax_id == "88729044715"
    assert payload.vehicle.plate == "KXK7802"
    assert payload.coverage_period is not None
    assert payload.coverage_period.ends_at is not None
    assert payload.coverage_period.ends_at.year == 2027
    assert payload.coverage_period.ends_at.day == 20
    assert payload.premium.total_payable is not None
    assert float(payload.premium.total_payable) == 3658.17
    assert len(payload.clauses) == 2


def test_proposal_extract_full_flow(client: TestClient) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get("/v1/me", headers=headers)
    assert me.status_code == 200
    user_id = me.json()["user"]["id"]

    cli = client.post(
        "/v1/clients",
        headers=headers,
        json={
            "full_name": "Elias Goncalves Saboia",
            "email": f"elias-{uuid.uuid4().hex}@example.com",
        },
    )
    assert cli.status_code == 201, cli.text
    client_id = cli.json()["id"]

    opp = client.post(
        "/v1/opportunities",
        headers=headers,
        json={
            "client_id": client_id,
            "owner_id": user_id,
            "insurance_line": "AUTO_INSURANCE",
            "stage": "QUALIFIED",
            "status": "OPEN",
            "next_action": "Aguardando análise da proposta",
        },
    )
    assert opp.status_code == 201, opp.text
    opp_id = opp.json()["id"]

    quote_suffix = uuid.uuid4().hex[:8].upper()
    quote_number = f"AUTO-{quote_suffix}"
    pdf_bytes = _build_proposal_pdf(
        [
            "BRADESCO SEGURO AUTO PRIME",
            "Bradesco Auto/RE Companhia de Seguros",
            f"Cotacao no: {quote_number}",
            "Data do calculo: 15/04/2026 09:29:37",
            "Validade: 22/04/2026",
            "Proponente: ELIAS GONCALVES SABOIA",
            "CPF: 887.290.447-15",
            "Data de nascimento: 09/01/1967",
            "Veiculo: JEEP COMPASS LIMITED",
            "Ano de fabricacao: 2017",
            "Ano do modelo: 2017",
            "Placa: KXK-7802",
            "Chassi: 988675134HKH20740",
            "Codigo Fipe: 0170470",
            "Premio liquido R$ 3.406,74",
            "IOF R$ 264,64",
            "Total a pagar R$ 3.658,17",
            "001 Cobertura Compreensiva",
            "106 Assistencia 24h Prime Dia/Noite",
            "157 Despesas Medicas e Hospitalares",
        ],
    )

    up = client.post(
        "/v1/documents",
        headers=headers,
        data={
            "document_type": "PROPOSAL",
            "opportunity_id": opp_id,
        },
        files={"file": ("bradesco-auto.pdf", pdf_bytes, "application/pdf")},
    )
    assert up.status_code == 201, up.text
    doc_body = up.json()
    assert doc_body["opportunity_id"] == opp_id
    assert doc_body["document_type"] == "PROPOSAL"

    extract = client.post(
        f"/v1/opportunities/{opp_id}/proposal-extract",
        headers=headers,
    )
    assert extract.status_code == 200, extract.text
    body = extract.json()
    assert body["proposal_source"] == "bradesco_pdf_v1"
    assert body["applied"] is True
    assert body["payload"] is not None
    assert body["payload"]["quote"]["number"] == quote_number
    assert body["payload"]["applicant"]["tax_id"] == "88729044715"
    assert body["validation_errors"] == []

    opp_after = client.get(f"/v1/opportunities/{opp_id}", headers=headers)
    assert opp_after.status_code == 200
    after = opp_after.json()
    assert after["quote_number"] == quote_number
    assert after["preferred_insurer_name"].startswith("Bradesco Auto")
    assert after["proposal_source"] == "bradesco_pdf_v1"
    assert after["proposal_data"]["quote"]["number"] == quote_number
    assert after["estimated_value"] == "3658.17"


def test_proposal_extract_returns_review_when_pdf_lacks_required_fields(
    client: TestClient,
) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/v1/me", headers=headers)
    user_id = me.json()["user"]["id"]

    cli = client.post(
        "/v1/clients",
        headers=headers,
        json={
            "full_name": "Sem Dados",
            "email": f"semdados-{uuid.uuid4().hex}@example.com",
        },
    )
    assert cli.status_code == 201
    client_id = cli.json()["id"]

    opp = client.post(
        "/v1/opportunities",
        headers=headers,
        json={
            "client_id": client_id,
            "owner_id": user_id,
            "insurance_line": "AUTO_INSURANCE",
            "stage": "LEAD",
            "status": "OPEN",
        },
    )
    assert opp.status_code == 201
    opp_id = opp.json()["id"]

    blank_pdf = _build_proposal_pdf(
        ["Documento sem campos reconheciveis pelo extrator de proposta."],
    )
    up = client.post(
        "/v1/documents",
        headers=headers,
        data={"document_type": "PROPOSAL", "opportunity_id": opp_id},
        files={"file": ("vazio.pdf", io.BytesIO(blank_pdf), "application/pdf")},
    )
    assert up.status_code == 201, up.text

    extract = client.post(
        f"/v1/opportunities/{opp_id}/proposal-extract",
        headers=headers,
    )
    assert extract.status_code == 200, extract.text
    body = extract.json()
    assert body["requires_review"] is True
    assert body["payload"] is None
    assert body["applied"] is False
    assert isinstance(body["validation_errors"], list)
    assert len(body["validation_errors"]) > 0

    opp_after = client.get(f"/v1/opportunities/{opp_id}", headers=headers)
    after = opp_after.json()
    assert after["proposal_data"] is None
    assert after["quote_number"] is None


def test_proposal_extract_404_when_no_proposal_document(client: TestClient) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/v1/me", headers=headers)
    user_id = me.json()["user"]["id"]
    cli = client.post(
        "/v1/clients",
        headers=headers,
        json={"full_name": "No Doc", "email": f"nd-{uuid.uuid4().hex}@example.com"},
    )
    assert cli.status_code == 201
    client_id = cli.json()["id"]

    opp = client.post(
        "/v1/opportunities",
        headers=headers,
        json={
            "client_id": client_id,
            "owner_id": user_id,
            "insurance_line": "AUTO_INSURANCE",
            "stage": "LEAD",
            "status": "OPEN",
        },
    )
    assert opp.status_code == 201
    opp_id = opp.json()["id"]

    extract = client.post(
        f"/v1/opportunities/{opp_id}/proposal-extract",
        headers=headers,
    )
    assert extract.status_code == 404


def test_document_upload_rejects_unknown_opportunity(client: TestClient) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    pdf_bytes = _build_proposal_pdf(["dummy"])
    up = client.post(
        "/v1/documents",
        headers=headers,
        data={"document_type": "PROPOSAL", "opportunity_id": str(uuid.uuid4())},
        files={"file": ("x.pdf", pdf_bytes, "application/pdf")},
    )
    assert up.status_code == 404
