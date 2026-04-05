from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime

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
    assert "property_type_missing_when_owns_property" in patched["alerts"]

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


def test_interactions_sync_opportunity_and_overdue_filter(client: TestClient) -> None:
    token, _email = _register(client)
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get("/v1/me", headers=headers)
    assert me.status_code == 200
    user_id = me.json()["user"]["id"]

    products = client.get("/v1/products", headers=headers)
    assert products.status_code == 200
    product_id = products.json()[0]["id"]

    create_client = client.post(
        "/v1/clients",
        headers=headers,
        json={"full_name": "Interaction Client", "email": f"ix-{uuid.uuid4().hex}@example.com"},
    )
    assert create_client.status_code == 201
    client_id = create_client.json()["id"]

    opp = client.post(
        "/v1/opportunities",
        headers=headers,
        json={
            "client_id": client_id,
            "owner_id": user_id,
            "product_id": product_id,
            "stage": "LEAD",
            "status": "OPEN",
        },
    )
    assert opp.status_code == 201, opp.text
    opp_id = opp.json()["id"]
    assert opp.json()["last_interaction_at"] is None

    occurred = datetime(2026, 3, 15, 14, 30, 0, tzinfo=UTC).isoformat()
    ix = client.post(
        "/v1/interactions",
        headers=headers,
        json={
            "client_id": client_id,
            "opportunity_id": opp_id,
            "interaction_type": "CALL",
            "summary": "Cliente pediu simulação",
            "occurred_at": occurred,
            "opportunity_next_action": "Enviar proposta",
            "opportunity_next_action_due_at": "2026-03-20T12:00:00+00:00",
        },
    )
    assert ix.status_code == 201, ix.text
    assert ix.json()["created_by"]["email"]

    opp_get = client.get(f"/v1/opportunities/{opp_id}", headers=headers)
    assert opp_get.status_code == 200
    og = opp_get.json()
    assert og["last_interaction_at"] is not None
    assert og["next_action"] == "Enviar proposta"
    assert og["next_action_due_at"] is not None

    listed = client.get(f"/v1/interactions?client_id={client_id}", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    client.patch(
        f"/v1/opportunities/{opp_id}",
        headers=headers,
        json={"next_action_due_at": "2019-01-01T00:00:00+00:00"},
    )
    overdue = client.get("/v1/opportunities?overdue_next_action=true", headers=headers)
    assert overdue.status_code == 200
    assert any(row["id"] == opp_id for row in overdue.json())


def test_module52_org_users_leads_convert_insured_audit(client: TestClient) -> None:
    token, _email = _register(client)
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get("/v1/me", headers=headers)
    assert me.status_code == 200
    my_id = me.json()["user"]["id"]

    org_users = client.get("/v1/org/users", headers=headers)
    assert org_users.status_code == 200
    assert any(u["id"] == my_id for u in org_users.json())

    lead = client.post(
        "/v1/leads",
        headers=headers,
        json={
            "full_name": "Lead One",
            "email": f"lead-{uuid.uuid4().hex}@example.com",
            "owner_id": my_id,
            "status": "NEW",
        },
    )
    assert lead.status_code == 201, lead.text
    lead_id = lead.json()["id"]

    listed = client.get("/v1/leads", headers=headers)
    assert listed.status_code == 200
    assert any(x["id"] == lead_id for x in listed.json())

    products = client.get("/v1/products", headers=headers)
    assert products.status_code == 200
    product_id = products.json()[0]["id"]

    conv = client.post(
        f"/v1/leads/{lead_id}/convert",
        headers=headers,
        json={
            "client_owner_id": my_id,
            "opportunity": {
                "owner_id": my_id,
                "product_id": product_id,
                "stage": "LEAD",
                "status": "OPEN",
                "estimated_value": "500.00",
                "closing_probability": 10,
            },
        },
    )
    assert conv.status_code == 200, conv.text
    conv_body = conv.json()
    assert conv_body["client"]["owner_id"] == my_id
    assert conv_body["opportunity"] is not None
    new_client_id = conv_body["client"]["id"]

    audit_converted = client.get(
        f"/v1/clients/{new_client_id}/audit-events",
        headers=headers,
    )
    assert audit_converted.status_code == 200
    assert len(audit_converted.json()) >= 1

    comp = client.post(
        "/v1/clients",
        headers=headers,
        json={
            "full_name": "Empresa SA",
            "client_kind": "COMPANY",
            "company_legal_name": "Empresa SA",
            "company_tax_id": "123",
            "owner_id": my_id,
        },
    )
    assert comp.status_code == 201, comp.text
    cid = comp.json()["id"]
    assert comp.json()["client_kind"] == "COMPANY"

    ins = client.post(
        f"/v1/clients/{cid}/insured-persons",
        headers=headers,
        json={"full_name": "Dependente", "relation": "DEPENDENT"},
    )
    assert ins.status_code == 201, ins.text
    ins_id = ins.json()["id"]

    detail = client.get(f"/v1/clients/{cid}", headers=headers)
    assert detail.status_code == 200
    assert len(detail.json()["insured_persons"]) == 1

    audit = client.get(f"/v1/clients/{cid}/audit-events", headers=headers)
    assert audit.status_code == 200
    events = audit.json()
    assert any(e["entity_type"] == "INSURED_PERSON" for e in events)

    patch_ins = client.patch(
        f"/v1/clients/{cid}/insured-persons/{ins_id}",
        headers=headers,
        json={"notes": "nota"},
    )
    assert patch_ins.status_code == 200

    del_ins = client.delete(
        f"/v1/clients/{cid}/insured-persons/{ins_id}",
        headers=headers,
    )
    assert del_ins.status_code == 204


def test_opportunity_product_54_rules_and_metrics(client: TestClient) -> None:
    token, _email = _register(client)
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get("/v1/me", headers=headers)
    assert me.status_code == 200
    user_id = me.json()["user"]["id"]

    products = client.get("/v1/products", headers=headers)
    assert products.status_code == 200
    product_id = products.json()[0]["id"]

    create_client = client.post(
        "/v1/clients",
        headers=headers,
        json={"full_name": "Opp S54", "email": f"s54-{uuid.uuid4().hex}@example.com"},
    )
    assert create_client.status_code == 201
    client_id = create_client.json()["id"]

    opp = client.post(
        "/v1/opportunities",
        headers=headers,
        json={
            "client_id": client_id,
            "owner_id": user_id,
            "product_id": product_id,
            "stage": "LEAD",
            "status": "OPEN",
        },
    )
    assert opp.status_code == 201, opp.text
    opp_id = opp.json()["id"]

    no_action = client.patch(
        f"/v1/opportunities/{opp_id}",
        headers=headers,
        json={"stage": "NEGOTIATION"},
    )
    assert no_action.status_code == 422

    with_action = client.patch(
        f"/v1/opportunities/{opp_id}",
        headers=headers,
        json={"stage": "NEGOTIATION", "next_action": "Rever proposta com o cliente"},
    )
    assert with_action.status_code == 200, with_action.text

    lost_no_reason = client.post(
        f"/v1/opportunities/{opp_id}/stage",
        headers=headers,
        json={"stage": "CLOSED_LOST"},
    )
    assert lost_no_reason.status_code == 422

    lost_ok = client.post(
        f"/v1/opportunities/{opp_id}/stage",
        headers=headers,
        json={"stage": "CLOSED_LOST", "loss_reason": "Preço acima do orçamento"},
    )
    assert lost_ok.status_code == 200, lost_ok.text
    assert lost_ok.json()["loss_reason"] == "Preço acima do orçamento"

    metrics = client.get("/v1/opportunities/metrics/summary", headers=headers)
    assert metrics.status_code == 200, metrics.text
    summary = metrics.json()
    assert "by_stage" in summary and "CLOSED_LOST" in summary["by_stage"]
    assert summary["open_total"] >= 0

    opp_open = client.post(
        "/v1/opportunities",
        headers=headers,
        json={
            "client_id": client_id,
            "owner_id": user_id,
            "product_id": product_id,
            "stage": "LEAD",
            "status": "OPEN",
        },
    )
    assert opp_open.status_code == 201
    open_id = opp_open.json()["id"]
    post_sale_early = client.post(
        f"/v1/opportunities/{open_id}/stage",
        headers=headers,
        json={"stage": "POST_SALE"},
    )
    assert post_sale_early.status_code == 422

    won = client.post(
        f"/v1/opportunities/{open_id}/stage",
        headers=headers,
        json={"stage": "CLOSED_WON"},
    )
    assert won.status_code == 200
    post_sale_ok = client.post(
        f"/v1/opportunities/{open_id}/stage",
        headers=headers,
        json={"stage": "POST_SALE"},
    )
    assert post_sale_ok.status_code == 200
    assert post_sale_ok.json()["stage"] == "POST_SALE"

    deal_fields = client.patch(
        f"/v1/opportunities/{open_id}",
        headers=headers,
        json={
            "preferred_insurer_name": "ACME Seguros",
            "expected_close_at": "2026-12-15T10:00:00+00:00",
        },
    )
    assert deal_fields.status_code == 200, deal_fields.text
    assert deal_fields.json()["preferred_insurer_name"] == "ACME Seguros"

    mine = client.get(f"/v1/opportunities?owner_id={user_id}&status=OPEN", headers=headers)
    assert mine.status_code == 200


def test_lead_opportunity_convert_repoints_and_intel_blocked_until_client(
    client: TestClient,
) -> None:
    token, _email = _register(client)
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get("/v1/me", headers=headers)
    assert me.status_code == 200
    my_id = me.json()["user"]["id"]

    other = client.post(
        "/v1/clients",
        headers=headers,
        json={"full_name": "Cliente só para URL de intel", "owner_id": my_id},
    )
    assert other.status_code == 201
    intel_client_id = other.json()["id"]

    lead = client.post(
        "/v1/leads",
        headers=headers,
        json={
            "full_name": "Lead Oportunidade",
            "email": f"l-{uuid.uuid4().hex}@example.com",
            "owner_id": my_id,
            "client_kind": "COMPANY",
            "company_legal_name": "Lead Corp Lda",
        },
    )
    assert lead.status_code == 201, lead.text
    lead_id = lead.json()["id"]

    opp = client.post(
        "/v1/opportunities",
        headers=headers,
        json={
            "lead_id": lead_id,
            "owner_id": my_id,
            "stage": "LEAD",
            "status": "OPEN",
            "closing_probability": 10,
            "next_action": "Contactar",
        },
    )
    assert opp.status_code == 201, opp.text
    opp_id = opp.json()["id"]
    assert opp.json()["lead_id"] == lead_id
    assert opp.json()["client_id"] is None

    intel = client.get(
        f"/v1/clients/{intel_client_id}/recommendations",
        headers=headers,
        params={"opportunity_id": opp_id},
    )
    assert intel.status_code == 400
    assert "lead" in str(intel.json().get("detail", "")).lower()

    conv = client.post(
        f"/v1/leads/{lead_id}/convert",
        headers=headers,
        json={"client_owner_id": my_id},
    )
    assert conv.status_code == 200, conv.text
    new_client_id = conv.json()["client"]["id"]
    assert conv.json()["client"]["client_kind"] == "COMPANY"
    assert conv.json()["client"]["company_legal_name"] == "Lead Corp Lda"

    opp_after = client.get(f"/v1/opportunities/{opp_id}", headers=headers)
    assert opp_after.status_code == 200
    ob = opp_after.json()
    assert ob["client_id"] == new_client_id
    assert ob["lead_id"] is None

    intel_ok = client.get(
        f"/v1/clients/{new_client_id}/recommendations",
        headers=headers,
        params={"opportunity_id": opp_id},
    )
    assert intel_ok.status_code == 200


def test_insurer_list_search_by_code_and_campaign_list_search(client: TestClient) -> None:
    token, _ = _register(client)
    headers = {"Authorization": f"Bearer {token}"}

    ins_a = client.post(
        "/v1/insurers",
        headers=headers,
        json={
            "name": "Insurer Alpha Search",
            "code": "UNIQCODE42",
            "active": True,
            "notes": "nota lateral",
        },
    )
    assert ins_a.status_code == 201, ins_a.text
    client.post(
        "/v1/insurers",
        headers=headers,
        json={"name": "Other Insurer", "code": "OTHER", "active": True},
    )

    by_code = client.get("/v1/insurers?active_only=false&q=UNIQCODE42", headers=headers)
    assert by_code.status_code == 200
    names = [x["name"] for x in by_code.json()]
    assert "Insurer Alpha Search" in names
    assert "Other Insurer" not in names

    by_notes = client.get("/v1/insurers?active_only=false&q=lateral", headers=headers)
    assert by_notes.status_code == 200
    assert any(x["code"] == "UNIQCODE42" for x in by_notes.json())

    camp = client.post(
        "/v1/campaigns",
        headers=headers,
        json={
            "name": "Campanha Verão",
            "kind": "SEASONAL",
            "template_body": "Olá",
            "active": True,
        },
    )
    assert camp.status_code == 201, camp.text
    client.post(
        "/v1/campaigns",
        headers=headers,
        json={
            "name": "Outra",
            "kind": "CUSTOM",
            "template_body": "Hi",
            "active": True,
        },
    )

    by_name = client.get("/v1/campaigns?q=Verão&limit=100", headers=headers)
    assert by_name.status_code == 200
    assert len(by_name.json()) >= 1
    assert all("Verão" in c["name"] for c in by_name.json())

    by_kind = client.get("/v1/campaigns?q=SEASONAL&limit=100", headers=headers)
    assert by_kind.status_code == 200
    kinds = [c["kind"] for c in by_kind.json()]
    assert "SEASONAL" in kinds
