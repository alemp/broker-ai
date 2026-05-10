"""Phase 3 — domain merge service (`apply_auto_proposal_to_opportunity`).

Covers ADR §D5/§D6 acceptance:

- The service is invoked by the PDF route end-to-end.
- Profile data is enriched with mobility vehicles + applicant scalars under
  the no-overwrite policy.
- Re-applying the same payload is a no-op (idempotency via the opportunity's
  stable identity and `record_field_updates`'s old==new short-circuit).
- After applying, `RULE_AUTO_GAP` no longer fires for the party.
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


def _register(client: TestClient) -> str:
    email = f"prop3-{uuid.uuid4().hex}@example.com"
    password = "longpassword123"
    reg = client.post(
        "/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Proposal Tester P3"},
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


# ---------------------------------------------------------------------------
# Pure helpers (no DB)
# ---------------------------------------------------------------------------


def test_normalize_tax_id_strips_punctuation() -> None:
    from ai_copilot_api.domain.proposal_ingest import normalize_tax_id

    assert normalize_tax_id("887.290.447-15") == "88729044715"
    assert normalize_tax_id("10.263.942/0001-16") == "10263942000116"
    assert normalize_tax_id("") is None
    assert normalize_tax_id(None) is None
    assert normalize_tax_id("   ") is None


def test_merge_mobility_block_upserts_by_chassis() -> None:
    from datetime import date
    from decimal import Decimal

    from ai_copilot_api.domain.proposal_ingest import merge_mobility_block
    from ai_copilot_api.schemas.proposal_ingest import (
        AutoProposalPayload,
        ProposalApplicant,
        ProposalCoverages,
        ProposalLiabilityLimits,
        ProposalPremium,
        ProposalQuote,
        ProposalVehicle,
    )

    payload = AutoProposalPayload(
        quote=ProposalQuote(
            number="Q-1",
            insurer_name="Bradesco Auto",
            calculated_at=None,
            valid_until=date(2026, 5, 1),
        ),
        applicant=ProposalApplicant(
            full_name="Test Person",
            tax_id="11122233344",
        ),
        vehicle=ProposalVehicle(
            make="JEEP",
            model="Compass",
            plate="ABC1234",
            chassis="VIN0000000001",
            usage="Particular",
        ),
        coverages=ProposalCoverages(
            civil_liability=ProposalLiabilityLimits(material_damage=Decimal("100000")),
        ),
        premium=ProposalPremium(total_payable=Decimal("1500.00")),
    )

    existing = {
        "mobility": {
            "owns_vehicle": True,
            "vehicles": [
                {
                    "make": "JEEP",
                    "model": "Compass",
                    "chassis": "VIN0000000001",
                    "plate": "OLD9999",
                },
            ],
        },
    }

    out, changed = merge_mobility_block(existing, payload)
    assert changed is True
    vehicles = out["mobility"]["vehicles"]
    assert len(vehicles) == 1
    veh = vehicles[0]
    assert veh["chassis"] == "VIN0000000001"
    assert veh["plate"] == "OLD9999"
    assert veh["usage"] == "Particular"
    assert veh["last_quote_number"] == "Q-1"


def test_merge_mobility_block_appends_new_vehicle() -> None:
    from decimal import Decimal

    from ai_copilot_api.domain.proposal_ingest import merge_mobility_block
    from ai_copilot_api.schemas.proposal_ingest import (
        AutoProposalPayload,
        ProposalApplicant,
        ProposalCoverages,
        ProposalPremium,
        ProposalQuote,
        ProposalVehicle,
    )

    payload = AutoProposalPayload(
        quote=ProposalQuote(insurer_name="Bradesco Auto", number="Q-2"),
        applicant=ProposalApplicant(full_name="X", tax_id="11122233344"),
        vehicle=ProposalVehicle(make="FORD", model="Ka", chassis="VIN0000000002"),
        coverages=ProposalCoverages(),
        premium=ProposalPremium(total_payable=Decimal("900.00")),
    )

    out, changed = merge_mobility_block(
        {"mobility": {"vehicles": [{"chassis": "VIN0000000001", "make": "JEEP"}]}},
        payload,
    )
    assert changed is True
    assert len(out["mobility"]["vehicles"]) == 2
    assert {v["chassis"] for v in out["mobility"]["vehicles"]} == {
        "VIN0000000001",
        "VIN0000000002",
    }
    assert out["mobility"]["vehicle_count"] == 2


# ---------------------------------------------------------------------------
# Integration via the proposal-extract route
# ---------------------------------------------------------------------------


def _make_proposal_pdf(quote_number: str, *, plate: str = "KXK7802") -> bytes:
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
            f"Placa: {plate}",
            "Chassi: 988675134HKH20740",
            "Codigo Fipe: 0170470",
            "Premio liquido R$ 3.406,74",
            "IOF R$ 264,64",
            "Total a pagar R$ 3.658,17",
            "001 Cobertura Compreensiva",
            "106 Assistencia 24h Prime Dia/Noite",
        ],
    )


def _bootstrap_opportunity(
    client: TestClient,
    *,
    profile_data: dict | None = None,
    extra_client_fields: dict | None = None,
) -> tuple[dict, str, str, str]:
    """Returns (headers, user_id, client_id, opp_id)."""
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/v1/me", headers=headers)
    user_id = me.json()["user"]["id"]

    payload: dict = {
        "full_name": "Elias Goncalves Saboia",
        "email": f"elias-{uuid.uuid4().hex}@example.com",
    }
    if extra_client_fields:
        payload.update(extra_client_fields)

    cli = client.post("/v1/clients", headers=headers, json=payload)
    assert cli.status_code == 201, cli.text
    client_id = cli.json()["id"]

    if profile_data:
        patch = client.patch(
            f"/v1/clients/{client_id}/profile",
            headers=headers,
            json=profile_data,
        )
        assert patch.status_code == 200, patch.text

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
    return headers, user_id, client_id, opp.json()["id"]


def _upload_pdf(client: TestClient, headers: dict, opp_id: str, pdf_bytes: bytes) -> None:
    up = client.post(
        "/v1/documents",
        headers=headers,
        data={"document_type": "PROPOSAL", "opportunity_id": opp_id},
        files={"file": ("bradesco-auto.pdf", pdf_bytes, "application/pdf")},
    )
    assert up.status_code == 201, up.text


def test_apply_extract_enriches_party_profile_with_vehicle(client: TestClient) -> None:
    headers, _user_id, client_id, opp_id = _bootstrap_opportunity(client)

    quote_number = f"AUTO-{uuid.uuid4().hex[:8].upper()}"
    _upload_pdf(client, headers, opp_id, _make_proposal_pdf(quote_number))

    res = client.post(f"/v1/opportunities/{opp_id}/proposal-extract", headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["applied"] is True

    enriched = client.get(f"/v1/clients/{client_id}/profile", headers=headers)
    assert enriched.status_code == 200, enriched.text
    profile = enriched.json()["profile"]
    mobility = profile.get("mobility") or {}
    vehicles = mobility.get("vehicles") or []
    assert mobility.get("owns_vehicle") is True
    assert len(vehicles) == 1
    veh = vehicles[0]
    assert veh.get("chassis") == "988675134HKH20740"
    assert veh.get("plate") == "KXK7802"
    model_value = (veh.get("model") or "").upper()
    assert "JEEP" in model_value or "COMPASS" in model_value
    assert veh.get("fabrication_year") == 2017
    assert veh.get("last_quote_number") == quote_number

    cli = client.get(f"/v1/clients/{client_id}", headers=headers)
    assert cli.status_code == 200
    body = cli.json()
    assert body.get("date_of_birth") == "1967-01-09"
    assert body.get("company_tax_id") == "88729044715"


def test_apply_extract_no_overwrite_existing_party_fields(client: TestClient) -> None:
    pre_existing_email = f"keep-{uuid.uuid4().hex}@example.com"
    headers, _user_id, client_id, opp_id = _bootstrap_opportunity(
        client,
        extra_client_fields={
            "email": pre_existing_email,
            "phone": "+55 11 99999-1111",
            "date_of_birth": "1980-05-05",
        },
        profile_data={
            "personal": {"marital_status": "Solteiro"},
            "mobility": {
                "owns_vehicle": True,
                "vehicles": [
                    {
                        "make": "FIAT",
                        "model": "Mobi",
                        "chassis": "988675134HKH20740",
                        "plate": "OLD0000",
                        "usage": "Particular",
                    },
                ],
            },
        },
    )

    quote_number = f"AUTO-{uuid.uuid4().hex[:8].upper()}"
    _upload_pdf(client, headers, opp_id, _make_proposal_pdf(quote_number))

    res = client.post(f"/v1/opportunities/{opp_id}/proposal-extract", headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["applied"] is True

    cli = client.get(f"/v1/clients/{client_id}", headers=headers)
    assert cli.status_code == 200
    body = cli.json()
    assert body["email"] == pre_existing_email
    assert body["phone"] == "+55 11 99999-1111"
    assert body["date_of_birth"] == "1980-05-05"

    profile = client.get(f"/v1/clients/{client_id}/profile", headers=headers).json()["profile"]
    assert profile["personal"]["marital_status"] == "Solteiro"

    vehicles = profile["mobility"]["vehicles"]
    assert len(vehicles) == 1
    veh = vehicles[0]
    assert veh["make"] == "FIAT"
    assert veh["model"] == "Mobi"
    assert veh["plate"] == "OLD0000"
    assert veh["chassis"] == "988675134HKH20740"
    assert veh["last_quote_number"] == quote_number


def test_apply_extract_is_idempotent(client: TestClient) -> None:
    headers, _user_id, _client_id, opp_id = _bootstrap_opportunity(client)

    quote_number = f"AUTO-{uuid.uuid4().hex[:8].upper()}"
    _upload_pdf(client, headers, opp_id, _make_proposal_pdf(quote_number))

    first = client.post(f"/v1/opportunities/{opp_id}/proposal-extract", headers=headers)
    assert first.status_code == 200, first.text
    first_data = first.json()["payload"]

    second = client.post(f"/v1/opportunities/{opp_id}/proposal-extract", headers=headers)
    assert second.status_code == 200, second.text
    second_data = second.json()["payload"]

    assert first_data == second_data

    opp_after = client.get(f"/v1/opportunities/{opp_id}", headers=headers).json()
    assert opp_after["quote_number"] == quote_number
    assert opp_after["proposal_data"]["quote"]["number"] == quote_number


def test_rule_auto_gap_does_not_fire_after_proposal_apply(client: TestClient) -> None:
    """ADR §D6 acceptance: with an applied auto proposal, RULE_AUTO_GAP is silenced."""
    from ai_copilot_api.db.models import Client
    from ai_copilot_api.db.session import new_session
    from ai_copilot_api.domain.recommendation_rules import assess_protection_gaps

    headers, _user_id, client_id, opp_id = _bootstrap_opportunity(
        client,
        profile_data={
            "personal": {"number_of_children": 1},
            "mobility": {"owns_vehicle": True, "vehicle_type": "Carro"},
        },
    )

    db = new_session()
    try:
        cuuid = uuid.UUID(client_id)
        party = db.get(Client, cuuid)
        assert party is not None
        gaps_before, _trace_before = assess_protection_gaps(party)
        assert gaps_before.want_auto is True
    finally:
        db.close()

    quote_number = f"AUTO-{uuid.uuid4().hex[:8].upper()}"
    _upload_pdf(client, headers, opp_id, _make_proposal_pdf(quote_number))
    res = client.post(f"/v1/opportunities/{opp_id}/proposal-extract", headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["applied"] is True

    db = new_session()
    try:
        cuuid = uuid.UUID(client_id)
        party = db.get(Client, cuuid)
        assert party is not None
        gaps_after, trace_after = assess_protection_gaps(party)
        assert gaps_after.want_auto is False
        codes = {r.rule_id: r.fired for r in trace_after}
        assert codes.get("RULE_AUTO_GAP") is False
    finally:
        db.close()
