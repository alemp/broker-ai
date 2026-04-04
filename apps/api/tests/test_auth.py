from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL is required for auth integration tests",
)


def _unique_email() -> str:
    return f"user-{uuid.uuid4().hex}@example.com"


def test_register_login_and_me(client: TestClient) -> None:
    email = _unique_email()
    password = "longpassword123"

    reg = client.post(
        "/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Test User"},
    )
    assert reg.status_code == 200, reg.text
    token = reg.json()["access_token"]
    assert token

    login = client.post(
        "/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200
    assert login.json()["access_token"]

    me = client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    body = me.json()
    assert body["user"]["email"] == email
    assert body["user"]["organization"]["slug"] == "default"


def test_register_duplicate_email(client: TestClient) -> None:
    email = _unique_email()
    password = "longpassword123"
    first = client.post(
        "/v1/auth/register",
        json={"email": email, "password": password},
    )
    assert first.status_code == 200
    second = client.post(
        "/v1/auth/register",
        json={"email": email, "password": password},
    )
    assert second.status_code == 409


def test_me_without_token(client: TestClient) -> None:
    response = client.get("/v1/me")
    assert response.status_code == 401
