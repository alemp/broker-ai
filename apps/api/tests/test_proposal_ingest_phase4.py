"""Phase 4 — JSON proposal ingest (`/v1/proposals/auto/*`)."""

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
    email = f"p4-{uuid.uuid4().hex}@example.com"
    reg = client.post(
        "/v1/auth/register",
        json={"email": email, "password": "longpassword123", "full_name": "Phase4 Tester"},
    )
    assert reg.status_code == 200, reg.text
    return reg.json()["access_token"]


def _minimal_canonical_payload(
    *,
    quote_number: str,
    tax_id: str,
    insurer_name: str = "Test Insurer Ltd",
) -> dict:
    return {
        "quote": {"number": quote_number, "item": 1, "insurer_name": insurer_name},
        "applicant": {"full_name": "JSON Ingest Tester", "tax_id": tax_id},
        "vehicle": {"make": "FORD", "model": "Ka"},
        "coverages": {},
        "premium": {"total_payable": "1500.00"},
    }


def test_select_adapter_accepts_bradesco_v1_alias() -> None:
    from ai_copilot_api.domain.proposal_adapters import select_adapter_for_json
    from ai_copilot_api.domain.proposal_adapters.bradesco_json_v1 import BradescoAutoJsonAdapterV1

    a = select_adapter_for_json("bradesco_v1")
    assert isinstance(a, BradescoAutoJsonAdapterV1)


def test_preview_does_not_create_opportunity(client: TestClient) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/v1/me", headers=headers)
    assert me.status_code == 200
    user_id = me.json()["user"]["id"]

    qn = f"P4-PREV-{uuid.uuid4().hex[:10].upper()}"
    tax = f"{uuid.uuid4().int % 10**11:011d}"
    body = {
        "source": "canonical_auto_v1",
        "payload": _minimal_canonical_payload(quote_number=qn, tax_id=tax),
        "owner_id": user_id,
        "create_lead_if_missing": True,
    }

    before = client.get("/v1/opportunities", headers=headers, params={"limit": 100})
    assert before.status_code == 200
    n_before = len(before.json())

    pv = client.post("/v1/proposals/auto/preview", headers=headers, json=body)
    assert pv.status_code == 200, pv.text
    pvj = pv.json()
    assert pvj["payload"] is not None
    assert pvj["opportunity_id"] is None
    assert pvj["would_create_lead"] is True

    after = client.get("/v1/opportunities", headers=headers, params={"limit": 100})
    assert len(after.json()) == n_before


def test_commit_creates_lead_and_opportunity_then_idempotent(client: TestClient) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/v1/me", headers=headers)
    user_id = me.json()["user"]["id"]

    qn = f"P4-COMMIT-{uuid.uuid4().hex[:10].upper()}"
    tax = f"{uuid.uuid4().int % 10**11:011d}"
    body = {
        "source": "canonical_auto_v1",
        "payload": _minimal_canonical_payload(quote_number=qn, tax_id=tax),
        "owner_id": user_id,
        "create_lead_if_missing": True,
    }

    c1 = client.post("/v1/proposals/auto/commit", headers=headers, json=body)
    assert c1.status_code == 200, c1.text
    j1 = c1.json()
    assert j1["applied"] is True
    assert j1["opportunity_id"] is not None
    assert j1["party_kind"] == "lead"
    opp_id_1 = j1["opportunity_id"]

    c2 = client.post("/v1/proposals/auto/commit", headers=headers, json=body)
    assert c2.status_code == 200, c2.text
    j2 = c2.json()
    assert j2["opportunity_id"] == opp_id_1
    assert j2["party_id"] == j1["party_id"]


def test_preview_resolves_existing_opportunity_after_commit(client: TestClient) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/v1/me", headers=headers)
    user_id = me.json()["user"]["id"]

    qn = f"P4-EXIST-{uuid.uuid4().hex[:10].upper()}"
    tax = f"{uuid.uuid4().int % 10**11:011d}"
    body = {
        "source": "canonical_auto_v1",
        "payload": _minimal_canonical_payload(quote_number=qn, tax_id=tax),
        "owner_id": user_id,
        "create_lead_if_missing": True,
    }
    assert client.post("/v1/proposals/auto/commit", headers=headers, json=body).status_code == 200

    pv = client.post("/v1/proposals/auto/preview", headers=headers, json=body)
    assert pv.status_code == 200, pv.text
    assert pv.json()["opportunity_id"] is not None


def test_preview_no_matching_party_when_create_lead_false(client: TestClient) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/v1/me", headers=headers)
    user_id = me.json()["user"]["id"]

    qn = f"P4-NOMATCH-{uuid.uuid4().hex[:10].upper()}"
    tax = f"{uuid.uuid4().int % 10**11:011d}"
    body = {
        "source": "canonical_auto_v1",
        "payload": _minimal_canonical_payload(quote_number=qn, tax_id=tax),
        "owner_id": user_id,
        "create_lead_if_missing": False,
    }
    res = client.post("/v1/proposals/auto/preview", headers=headers, json=body)
    assert res.status_code == 422, res.text
    assert res.json()["detail"]["code"] == "NO_MATCHING_PARTY"


def test_unknown_source_returns_422(client: TestClient) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/v1/me", headers=headers)
    user_id = me.json()["user"]["id"]
    res = client.post(
        "/v1/proposals/auto/preview",
        headers=headers,
        json={
            "source": "unknown_carrier_xyz",
            "payload": {},
            "owner_id": user_id,
        },
    )
    assert res.status_code == 422
    assert res.json()["detail"]["code"] == "UNKNOWN_PROPOSAL_SOURCE"


def test_webhook_stub_returns_501(client: TestClient) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post("/v1/proposals/auto/webhook", headers=headers, json={})
    assert res.status_code == 501
    assert res.json()["detail"]["code"] == "WEBHOOK_NOT_ENABLED"
