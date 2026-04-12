from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL is required for Phase 9 integration tests",
)


def _register(client: TestClient) -> str:
    email = f"p9-{uuid.uuid4().hex}@example.com"
    password = "longpassword123"
    reg = client.post(
        "/v1/auth/register",
        json={"email": email, "password": password, "full_name": "P9 Tester"},
    )
    assert reg.status_code == 200, reg.text
    return reg.json()["access_token"]


def test_adequacy_batch_refresh_and_dashboard_summary(client: TestClient) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}

    create = client.post(
        "/v1/clients",
        headers=headers,
        json={"full_name": "Batch Client", "email": f"c-{uuid.uuid4().hex}@example.com"},
    )
    assert create.status_code == 201, create.text
    cid = create.json()["id"]

    ad_pre = client.get(f"/v1/clients/{cid}/adequacy", headers=headers)
    assert ad_pre.status_code == 200, ad_pre.text
    assert ad_pre.json()["source"] == "live"

    dash_before = client.get("/v1/dashboard/adequacy-summary", headers=headers)
    assert dash_before.status_code == 200, dash_before.text
    body0 = dash_before.json()
    assert body0["total_clients"] >= 1

    job = client.post("/v1/jobs/adequacy-refresh", headers=headers)
    assert job.status_code == 200, job.text
    jr = job.json()
    assert jr["status"] == "SUCCESS"
    assert jr["clients_processed"] >= 1
    assert jr["finished_at"] is not None

    dash_after = client.get("/v1/dashboard/adequacy-summary", headers=headers)
    assert dash_after.status_code == 200
    body1 = dash_after.json()
    assert body1["snapshot_green"] + body1["snapshot_yellow"] + body1["snapshot_red"] >= 1
    assert body1["last_job"] is not None
    assert body1["last_job"]["status"] == "SUCCESS"

    last = client.get("/v1/jobs/adequacy-refresh/last", headers=headers)
    assert last.status_code == 200
    assert last.json() is not None
    assert last.json()["id"] == jr["id"]

    ad = client.get(f"/v1/clients/{cid}/adequacy", headers=headers)
    assert ad.status_code == 200, ad.text
    a = ad.json()
    assert a["source"] == "batch"
    assert a["computed_at"] is not None
    assert a["inputs_hash"] is not None
    assert a["rule_version"] == "phase9-v1"

    listed = client.get("/v1/clients", headers=headers)
    assert listed.status_code == 200
    row = next(x for x in listed.json() if x["id"] == cid)
    assert row["adequacy_traffic_light"] == a["traffic_light"]
    assert row["adequacy_computed_at"] is not None

    filt = client.get(
        "/v1/clients",
        headers=headers,
        params={"adequacy_traffic_light": a["traffic_light"]},
    )
    assert filt.status_code == 200
    ids = {x["id"] for x in filt.json()}
    assert cid in ids

    live = client.get(
        f"/v1/clients/{cid}/adequacy",
        headers=headers,
        params={"source": "live"},
    )
    assert live.status_code == 200
    assert live.json()["source"] == "live"
