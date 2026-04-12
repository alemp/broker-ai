from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL is required for integration tests",
)


def _register(client: TestClient) -> tuple[str, str]:
    email = f"m56-{uuid.uuid4().hex}@example.com"
    password = "longpassword123"
    reg = client.post(
        "/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Modules Tester"},
    )
    assert reg.status_code == 200, reg.text
    return reg.json()["access_token"], email


def test_insurer_product_intel_campaign_flow(client: TestClient) -> None:
    token, _email = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    insurer_code = f"DEMO{uuid.uuid4().hex[:8].upper()}"

    ins = client.post(
        "/v1/insurers",
        headers=headers,
        json={"name": "Seguradora Demo", "code": insurer_code, "active": True},
    )
    assert ins.status_code == 201, ins.text
    insurer_id = ins.json()["id"]

    prod = client.post(
        "/v1/products",
        headers=headers,
        json={
            "name": "Vida Família Plus",
            "category": "LIFE_INSURANCE",
            "description": "Catálogo",
            "risk_level": "MEDIUM",
            "active": True,
            "insurer_id": insurer_id,
            "main_coverage_summary": "Morte e invalidez",
            "commercial_arguments": "Proteção familiar",
        },
    )
    assert prod.status_code == 201, prod.text
    product_id = prod.json()["id"]
    assert prod.json()["insurer_id"] == insurer_id
    assert prod.json()["main_coverage_summary"] == "Morte e invalidez"

    plist = client.get("/v1/products?q=Família", headers=headers)
    assert plist.status_code == 200
    assert len(plist.json()) >= 1

    me = client.get("/v1/me", headers=headers)
    user_id = me.json()["user"]["id"]

    cli = client.post(
        "/v1/clients",
        headers=headers,
        json={
            "full_name": "Cliente Intel",
            "email": f"intel-{uuid.uuid4().hex}@example.com",
            "marketing_opt_in": True,
            "preferred_marketing_channel": "EMAIL",
        },
    )
    assert cli.status_code == 201, cli.text
    client_id = cli.json()["id"]
    assert cli.json()["marketing_opt_in"] is True

    patch_prof = client.patch(
        f"/v1/clients/{client_id}/profile",
        headers=headers,
        json={"personal": {"number_of_children": 2, "life_stage": "young_family"}},
    )
    assert patch_prof.status_code == 200, patch_prof.text

    ad = client.get(f"/v1/clients/{client_id}/adequacy", headers=headers)
    assert ad.status_code == 200, ad.text
    body_ad = ad.json()
    assert body_ad["traffic_light"] in ("RED", "YELLOW", "GREEN")
    assert "summary" in body_ad

    run = client.post(
        f"/v1/clients/{client_id}/recommendation-runs",
        headers=headers,
        json={},
    )
    assert run.status_code == 201, run.text
    run_body = run.json()
    assert "items" in run_body
    assert "rule_trace" in run_body
    run_id = run_body["id"]
    if run_body["items"]:
        pid = run_body["items"][0]["product_id"]
        fb = client.post(
            "/v1/clients/recommendation-feedback",
            headers=headers,
            json={
                "client_id": client_id,
                "product_id": pid,
                "recommendation_run_id": run_id,
                "rule_ids": "RULE_FAMILY_PROTECTION",
                "action": "ACCEPTED",
            },
        )
        assert fb.status_code == 201, fb.text

    hist = client.get(f"/v1/clients/{client_id}/recommendation-runs", headers=headers)
    assert hist.status_code == 200
    assert len(hist.json()) >= 1

    queue = client.get("/v1/clients/adequacy-review-queue", headers=headers)
    assert queue.status_code == 200
    assert isinstance(queue.json(), list)

    when = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    camp = client.post(
        "/v1/campaigns",
        headers=headers,
        json={
            "name": "Aniversários",
            "kind": "BIRTHDAY",
            "template_body": "Olá {{nome}}, feliz aniversário!",
            "segment_criteria": {"marketing_opt_in": True},
            "active": True,
        },
    )
    assert camp.status_code == 201, camp.text
    camp_id = camp.json()["id"]

    refresh = client.post(
        f"/v1/campaigns/{camp_id}/segment-refresh",
        headers=headers,
        json={"scheduled_at": when, "channel": "EMAIL"},
    )
    assert refresh.status_code == 200, refresh.text
    touches = refresh.json()
    assert isinstance(touches, list)
    assert any(t["client_id"] == client_id for t in touches)

    touch_id = touches[0]["id"]
    mark = client.patch(
        f"/v1/campaigns/{camp_id}/touches/{touch_id}",
        headers=headers,
        json={"status": "SENT", "notes": "enviado em teste"},
    )
    assert mark.status_code == 200, mark.text

    opps = client.get("/v1/opportunities?sort=propensity_desc&limit=5", headers=headers)
    assert opps.status_code == 200

    # Opportunity for mismatch check
    opp = client.post(
        "/v1/opportunities",
        headers=headers,
        json={
            "client_id": client_id,
            "owner_id": user_id,
            "product_id": product_id,
            "estimated_value": "5000",
            "closing_probability": 50,
            "stage": "LEAD",
            "status": "OPEN",
        },
    )
    assert opp.status_code == 201, opp.text
    opp_id = opp.json()["id"]
    bad = client.post(
        f"/v1/clients/{client_id}/recommendation-runs",
        headers=headers,
        json={"opportunity_id": str(uuid.uuid4())},
    )
    assert bad.status_code == 404

    run_ctx = client.post(
        f"/v1/clients/{client_id}/recommendation-runs",
        headers=headers,
        json={"opportunity_id": opp_id},
    )
    assert run_ctx.status_code == 201, run_ctx.text

    preview = client.get(f"/v1/clients/{client_id}/recommendations", headers=headers)
    assert preview.status_code == 200, preview.text
    prev_body = preview.json()
    assert "items" in prev_body and "rule_trace" in prev_body

    preview_ctx = client.get(
        f"/v1/clients/{client_id}/recommendations?opportunity_id={opp_id}",
        headers=headers,
    )
    assert preview_ctx.status_code == 200, preview_ctx.text


def test_phase6_recommendations_auto_gap_and_profile_rules(client: TestClient) -> None:
    """Phase 6 — profile mobility auto gap + GET preview; profile income band life signal."""
    token, _email = _register(client)
    headers = {"Authorization": f"Bearer {token}"}

    cli = client.post(
        "/v1/clients",
        headers=headers,
        json={
            "full_name": "Cliente Auto Perfil",
            "email": f"auto-prof-{uuid.uuid4().hex}@example.com",
        },
    )
    assert cli.status_code == 201, cli.text
    client_id = cli.json()["id"]

    mob = client.patch(
        f"/v1/clients/{client_id}/profile",
        headers=headers,
        json={"mobility": {"owns_vehicle": True}},
    )
    assert mob.status_code == 200, mob.text

    auto_prod = client.post(
        "/v1/products",
        headers=headers,
        json={
            "name": "Auto Catálogo Teste",
            "category": "AUTO_INSURANCE",
            "description": "Fase 6",
            "risk_level": "MEDIUM",
            "active": True,
        },
    )
    assert auto_prod.status_code == 201, auto_prod.text

    prev = client.get(f"/v1/clients/{client_id}/recommendations", headers=headers)
    assert prev.status_code == 200, prev.text
    body = prev.json()
    assert any("RULE_AUTO_GAP" in (it.get("rule_ids") or []) for it in body["items"])
    assert any(
        t.get("rule_id") == "RULE_AUTO_GAP" and t.get("fired") for t in body["rule_trace"]
    )

    prof_patch = client.patch(
        f"/v1/clients/{client_id}/profile",
        headers=headers,
        json={"professional": {"approximate_income_band": "high_tier"}},
    )
    assert prof_patch.status_code == 200, prof_patch.text

    life_prod = client.post(
        "/v1/products",
        headers=headers,
        json={
            "name": "Vida High Earner Teste",
            "category": "LIFE_INSURANCE",
            "description": "Fase 6 perfil",
            "risk_level": "LOW",
            "active": True,
        },
    )
    assert life_prod.status_code == 201, life_prod.text

    prev2 = client.get(f"/v1/clients/{client_id}/recommendations", headers=headers)
    assert prev2.status_code == 200, prev2.text
    body2 = prev2.json()
    assert any(
        "RULE_PROFILE_HIGH_EARNER_PROTECTION" in (it.get("rule_ids") or [])
        for it in body2["items"]
    )


def test_recommendation_rules_catalog_requires_auth(client: TestClient) -> None:
    r = client.get("/v1/recommendation-rules")
    assert r.status_code == 401


def test_recommendation_rules_catalog_lists_builtins(client: TestClient) -> None:
    token, _email = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    r = client.get("/v1/recommendation-rules", headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    ids = {row["rule_id"] for row in data}
    assert "RULE_AUTO_GAP" in ids
    for row in data:
        assert row.get("rule_id")
        assert row.get("title")
        assert "description" in row
        assert isinstance(row.get("inputs"), list)


def test_catalog_product_line_category_filter_and_insurer_products(client: TestClient) -> None:
    token, _email = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    code = f"CAT{uuid.uuid4().hex[:8].upper()}"
    ins = client.post(
        "/v1/insurers",
        headers=headers,
        json={"name": "Seguradora Catálogo", "code": code, "active": True},
    )
    assert ins.status_code == 201, ins.text
    insurer_id = ins.json()["id"]

    auto = client.post(
        "/v1/products",
        headers=headers,
        json={
            "name": "Auto Cat Test",
            "product_line": "Particulares",
            "category": "AUTO_INSURANCE",
            "risk_level": "MEDIUM",
            "active": True,
            "insurer_id": insurer_id,
            "main_coverage_summary": "RCO",
        },
    )
    assert auto.status_code == 201, auto.text
    assert auto.json()["product_line"] == "Particulares"

    life = client.post(
        "/v1/products",
        headers=headers,
        json={
            "name": "Vida Cat Test",
            "category": "LIFE_INSURANCE",
            "risk_level": "LOW",
            "active": True,
            "insurer_id": insurer_id,
        },
    )
    assert life.status_code == 201, life.text

    only_life = client.get(
        "/v1/products?category=LIFE_INSURANCE&active_only=false",
        headers=headers,
    )
    assert only_life.status_code == 200
    life_names = {row["name"] for row in only_life.json()}
    assert "Vida Cat Test" in life_names
    assert "Auto Cat Test" not in life_names

    by_insurer = client.get(
        f"/v1/insurers/{insurer_id}/products?active_only=false",
        headers=headers,
    )
    assert by_insurer.status_code == 200
    names = {row["name"] for row in by_insurer.json()}
    assert names >= {"Auto Cat Test", "Vida Cat Test"}

    nf = client.get(f"/v1/insurers/{uuid.uuid4()}/products", headers=headers)
    assert nf.status_code == 404
