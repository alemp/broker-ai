from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL is required for CRM integration tests",
)


def _register(client: TestClient) -> tuple[str, str]:
    email = f"crm-{uuid.uuid4().hex}@example.com"
    password = "longpassword123"
    reg = client.post(
        "/v1/auth/register",
        json={"email": email, "password": password, "full_name": "CRM Tester"},
    )
    assert reg.status_code == 200, reg.text
    return reg.json()["access_token"], email


def test_client_portfolio_and_opportunity_flow(client: TestClient) -> None:
    token, _email = _register(client)
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get("/v1/me", headers=headers)
    assert me.status_code == 200
    user_id = me.json()["user"]["id"]

    lobs = client.get("/v1/lines-of-business", headers=headers)
    assert lobs.status_code == 200
    lob_list = lobs.json()
    assert len(lob_list) >= 1
    motor_id = next(x["id"] for x in lob_list if x["code"] == "MOTOR")

    products = client.get("/v1/products", headers=headers)
    assert products.status_code == 200
    product_list = products.json()
    assert len(product_list) >= 1
    product_id = product_list[0]["id"]

    create_client = client.post(
        "/v1/clients",
        headers=headers,
        json={
            "full_name": "Alice Broker",
            "email": f"alice-{uuid.uuid4().hex}@example.com",
        },
    )
    assert create_client.status_code == 201, create_client.text
    client_id = create_client.json()["id"]

    link = client.post(
        f"/v1/clients/{client_id}/lines-of-business",
        headers=headers,
        json={"line_of_business_id": motor_id, "ingestion_source": "internal_crm"},
    )
    assert link.status_code == 201, link.text
    assert link.json()["ingestion_source"] == "internal_crm"

    held = client.post(
        f"/v1/clients/{client_id}/held-products",
        headers=headers,
        json={
            "product_id": product_id,
            "insurer_name": "Acme Insurers",
            "ingestion_source": "internal_crm",
        },
    )
    assert held.status_code == 201, held.text
    assert held.json()["ingestion_source"] == "internal_crm"

    detail = client.get(f"/v1/clients/{client_id}", headers=headers)
    assert detail.status_code == 200
    body = detail.json()
    assert len(body["lines_of_business"]) == 1
    assert len(body["held_products"]) == 1
    assert body["profile_completeness_score"] == 0
    assert body["profile_alerts"] == []
    assert isinstance(body["profile"], dict)

    prof_get = client.get(f"/v1/clients/{client_id}/profile", headers=headers)
    assert prof_get.status_code == 200
    assert prof_get.json()["completeness_score"] == 0

    patch_prof = client.patch(
        f"/v1/clients/{client_id}/profile",
        headers=headers,
        json={
            "personal": {"life_stage": "young_family", "number_of_children": 2},
            "residence": {"owns_property": True},
        },
    )
    assert patch_prof.status_code == 200, patch_prof.text
    patched = patch_prof.json()
    assert patched["profile"]["personal"]["life_stage"] == "young_family"
    assert patched["profile"]["personal"]["number_of_children"] == 2
    assert patched["profile"]["residence"]["owns_property"] is True
    assert "life_stage_missing_when_children" in patched["alerts"]

    detail2 = client.get(f"/v1/clients/{client_id}", headers=headers)
    assert detail2.status_code == 200
    b2 = detail2.json()
    assert b2["profile"]["personal"]["life_stage"] == "young_family"
    assert b2["profile_completeness_score"] > 0

    opp = client.post(
        "/v1/opportunities",
        headers=headers,
        json={
            "client_id": client_id,
            "owner_id": user_id,
            "product_id": product_id,
            "estimated_value": "1234.50",
            "closing_probability": 40,
            "stage": "LEAD",
            "status": "OPEN",
            "source": "referral",
        },
    )
    assert opp.status_code == 201, opp.text
    opp_id = opp.json()["id"]
    assert opp.json()["stage"] == "LEAD"

    stage = client.post(
        f"/v1/opportunities/{opp_id}/stage",
        headers=headers,
        json={"stage": "CLOSED_WON"},
    )
    assert stage.status_code == 200, stage.text
    assert stage.json()["stage"] == "CLOSED_WON"
    assert stage.json()["status"] == "WON"
