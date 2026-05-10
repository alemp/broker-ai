"""Phase 6 — Documents ↔ Opportunity wiring (auto-apply + detail embedding).

Covers the deliverables in `docs/PROPOSAL-INGEST-IMPLEMENTATION.md` Phase 6:

- ``GET /v1/documents`` accepts an ``opportunity_id`` filter (tenant-guarded).
- ``GET /v1/opportunities/{opp_id}`` returns ``OpportunityDetailOut`` with a
  ``documents: list[DocumentBrief]`` block including the latest extraction
  summary.
- ``POST /v1/documents/{doc_id}/extract`` auto-applies the canonical proposal
  to the linked opportunity when confidence is high enough, using the
  opportunity's ``insurance_line`` instead of any request-side hint.
"""

from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL is required for proposal ingest integration tests",
)


def _build_proposal_pdf(text_lines: list[str]) -> bytes:
    """Hand-rolled minimal PDF whose pypdf can extract ``text_lines`` verbatim."""
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


def _make_proposal_pdf(quote_number: str) -> bytes:
    return _build_proposal_pdf(
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
            "Placa: KXK7802",
            "Chassi: 988675134HKH20740",
            "Codigo Fipe: 0170470",
            "Premio liquido R$ 3.406,74",
            "IOF R$ 264,64",
            "Total a pagar R$ 3.658,17",
            "001 Cobertura Compreensiva",
            "106 Assistencia 24h Prime Dia/Noite",
        ],
    )


def _register(client: TestClient, *, prefix: str = "p6") -> str:
    email = f"{prefix}-{uuid.uuid4().hex}@example.com"
    reg = client.post(
        "/v1/auth/register",
        json={"email": email, "password": "longpassword123", "full_name": "Phase6 Tester"},
    )
    assert reg.status_code == 200, reg.text
    return reg.json()["access_token"]


def _bootstrap_opportunity(client: TestClient) -> tuple[dict, str, str]:
    """Returns (headers, client_id, opportunity_id) for an AUTO opportunity."""
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/v1/me", headers=headers)
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
    return headers, client_id, opp.json()["id"]


def _upload_proposal_pdf(
    client: TestClient,
    headers: dict,
    opp_id: str,
    pdf_bytes: bytes,
    *,
    filename: str = "bradesco-auto.pdf",
) -> str:
    up = client.post(
        "/v1/documents",
        headers=headers,
        data={"document_type": "PROPOSAL", "opportunity_id": opp_id},
        files={"file": (filename, pdf_bytes, "application/pdf")},
    )
    assert up.status_code == 201, up.text
    return up.json()["id"]


# ---------------------------------------------------------------------------
# GET /v1/documents?opportunity_id=...
# ---------------------------------------------------------------------------


def test_list_documents_filters_by_opportunity(client: TestClient) -> None:
    headers, _client_id, opp_id = _bootstrap_opportunity(client)

    quote_number = f"AUTO-{uuid.uuid4().hex[:8].upper()}"
    doc_id = _upload_proposal_pdf(client, headers, opp_id, _make_proposal_pdf(quote_number))

    # Second document NOT linked to the opportunity (admin-only catalog upload).
    other_pdf = _build_proposal_pdf(["UNRELATED PROPOSAL", "Cotacao no: ZZZ-OUTRA"])
    up_unlinked = client.post(
        "/v1/documents",
        headers=headers,
        data={"document_type": "PROPOSAL"},
        files={"file": ("unlinked.pdf", other_pdf, "application/pdf")},
    )
    assert up_unlinked.status_code == 201, up_unlinked.text
    other_doc_id = up_unlinked.json()["id"]

    # Filtered listing: must return only the document tied to the opportunity.
    filtered = client.get(
        "/v1/documents",
        headers=headers,
        params={"opportunity_id": opp_id},
    )
    assert filtered.status_code == 200, filtered.text
    rows = filtered.json()
    ids = {r["id"] for r in rows}
    assert doc_id in ids
    assert other_doc_id not in ids
    assert all(r.get("opportunity_id") == opp_id for r in rows)

    # Unfiltered listing must still return both.
    full = client.get("/v1/documents", headers=headers)
    assert full.status_code == 200
    full_ids = {r["id"] for r in full.json()}
    assert {doc_id, other_doc_id}.issubset(full_ids)


def test_list_documents_filter_rejects_unknown_opportunity(client: TestClient) -> None:
    """Tenant guard: filtering by an opportunity not in the caller's org -> 404."""
    headers, _client_id, opp_id = _bootstrap_opportunity(client)

    bogus = "00000000-0000-0000-0000-000000000000"
    res = client.get(
        "/v1/documents",
        headers=headers,
        params={"opportunity_id": bogus},
    )
    assert res.status_code == 404, res.text
    assert "Opportunity not found" in res.text

    own = client.get("/v1/documents", headers=headers, params={"opportunity_id": opp_id})
    assert own.status_code == 200


# ---------------------------------------------------------------------------
# GET /v1/opportunities/{id} -> OpportunityDetailOut.documents
# ---------------------------------------------------------------------------


def test_opportunity_detail_embeds_documents_with_extraction_summary(
    client: TestClient,
) -> None:
    headers, _client_id, opp_id = _bootstrap_opportunity(client)
    quote_number = f"AUTO-{uuid.uuid4().hex[:8].upper()}"
    doc_id = _upload_proposal_pdf(client, headers, opp_id, _make_proposal_pdf(quote_number))

    # Run synchronous proposal-extract (Phase 2/3 path) to seed an extraction run.
    res = client.post(f"/v1/opportunities/{opp_id}/proposal-extract", headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["applied"] is True

    detail = client.get(f"/v1/opportunities/{opp_id}", headers=headers)
    assert detail.status_code == 200, detail.text
    body = detail.json()

    docs = body.get("documents")
    assert isinstance(docs, list) and len(docs) == 1
    brief = docs[0]
    assert brief["id"] == doc_id
    assert brief["document_type"] == "PROPOSAL"
    assert brief["original_filename"] == "bradesco-auto.pdf"
    assert brief["current_version"] == 1
    run = brief.get("latest_extraction_run")
    assert run is not None
    assert run["confidence"] >= 70
    assert run["requires_review"] is False


# ---------------------------------------------------------------------------
# POST /v1/documents/{id}/extract -> auto-apply when confidence >= 70
# ---------------------------------------------------------------------------


def test_document_extract_auto_applies_for_linked_opportunity(client: TestClient) -> None:
    headers, client_id, opp_id = _bootstrap_opportunity(client)
    quote_number = f"AUTO-{uuid.uuid4().hex[:8].upper()}"
    doc_id = _upload_proposal_pdf(client, headers, opp_id, _make_proposal_pdf(quote_number))

    ex = client.post(f"/v1/documents/{doc_id}/extract", headers=headers)
    assert ex.status_code == 202, ex.text
    assert ex.json()["job_type"] == "document_extraction"

    # Background task is executed synchronously by TestClient, so by now the
    # opportunity should already carry the canonical proposal payload.
    opp_after = client.get(f"/v1/opportunities/{opp_id}", headers=headers).json()
    assert opp_after["quote_number"] == quote_number
    assert opp_after["proposal_source"] == "bradesco_pdf_v1"
    assert opp_after["proposal_data"]["quote"]["number"] == quote_number

    # Documents tab must reflect the new extraction run.
    docs = opp_after["documents"]
    assert len(docs) == 1
    run = docs[0]["latest_extraction_run"]
    assert run is not None
    assert run["confidence"] >= 70
    assert run["requires_review"] is False

    # Profile enrichment from the canonical adapter ran end-to-end.
    profile = client.get(f"/v1/clients/{client_id}/profile", headers=headers).json()["profile"]
    vehicles = (profile.get("mobility") or {}).get("vehicles") or []
    assert len(vehicles) == 1
    assert vehicles[0].get("chassis") == "988675134HKH20740"
