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
    email = f"org-{uuid.uuid4().hex}@example.com"
    password = "longpassword123"
    reg = client.post(
        "/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Org Admin"},
    )
    assert reg.status_code == 200, reg.text
    return reg.json()["access_token"], email


def test_admin_can_update_organization_name(client: TestClient) -> None:
    token, _email = _register(client)
    headers = {"Authorization": f"Bearer {token}"}

    org_before = client.get("/v1/org/admin", headers=headers)
    assert org_before.status_code == 200, org_before.text
    before = org_before.json()
    assert before["name"]
    assert before["slug"]

    new_name = f"Org {uuid.uuid4().hex[:8]}"
    patch = client.patch("/v1/org/admin", headers=headers, json={"name": new_name})
    assert patch.status_code == 200, patch.text
    after = patch.json()
    assert after["id"] == before["id"]
    assert after["slug"] == before["slug"]
    assert after["name"] == new_name

