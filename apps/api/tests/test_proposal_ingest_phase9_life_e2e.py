"""Phase 9 — Life proposal ingest end-to-end.

Exercises the line-agnostic JSON ingest channel for a Tokio Marine PME
group-life payload through preview → commit → idempotent re-commit. Uses
both the legacy ``/v1/proposals/auto/*`` URLs and the new neutral
``/v1/proposals/*`` aliases to prove the channel is line-neutral.
"""

from __future__ import annotations

import os
import uuid
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from ai_copilot_api.db.enums import ProductCategory

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL is required for proposal ingest integration tests",
)


# A trimmed but realistic Tokio PME group-life carrier payload. Mirrors the
# shape exercised by ``test_tokio_life_json_adapter`` and is unique per test
# run by virtue of `quote.numero` and `estipulante.cnpj` being formatted in.
def _tokio_life_payload(*, quote_number: str, cnpj: str) -> dict:
    return {
        "proposta_seguro_vida": {
            "tipo_produto": "PME Vida Empresa",
            "tipo_seguro": "Novo",
            "seguradora": {
                "nome": "Tokio Marine Seguradora S.A.",
                "registro_susep": "6190-0",
            },
            "cotacao": {
                "numero": quote_number,
                "data_referencia": "2026-02-02",
                "data_impressao": "2026-02-02",
                "hora_impressao": "11:02:15",
                "validade_dias": 60,
            },
            "corretora": {
                "codigo": "061818",
                "nome": "CASUS CONSULTORIA E CORRETAGEM DE SEGUROS LTDA ME",
            },
            "estipulante": {
                "razao_social": "GRDL ENGENHARIA, CONSULTORIAS E REFORMAS LTDA",
                "cnpj": cnpj,
                "atividade": "SERVIÇOS DE PINTURA DE EDIFICIOS EM GERAL",
                "cnae": "4330404",
            },
            "perfil_grupo": {
                "grupo_segurado": ["Sócios", "Funcionários"],
                "forma_adesao": "Compulsória",
                "custeio": "Não Contributário",
                "possui_plano_saude": True,
                "quantidade_vidas": 2,
            },
            "capital_segurado": {
                "forma_calculo": "Múltiplo Salarial",
                "multiplicador_salario": 10,
                "capital_total": 30000.00,
            },
            "coberturas": [
                {
                    "codigo": "BASICA_MORTE",
                    "descricao": "Morte",
                    "percentual_indenizacao": 100.0,
                    "capital_segurado_minimo": 15000.00,
                    "capital_segurado_maximo": 15000.00,
                    "premio": 19.28,
                },
                {
                    "codigo": "IEA",
                    "descricao": "Indenização Especial por Acidente",
                    "percentual_indenizacao": 100.0,
                    "capital_segurado_minimo": 15000.00,
                    "capital_segurado_maximo": 15000.00,
                    "premio": 10.52,
                    "acumulavel_morte_acidental": True,
                },
            ],
            "precificacao": {
                "premio_minimo_estipulante": 50.00,
                "fatura_mensal": 31.68,
                "premio_total_coberturas": 31.68,
            },
            "condicoes_aceitacao": {
                "adesao_100_porcento_obrigatoria": True,
                "idade_limite_aceitacao": 75,
            },
        },
    }


def _register(client: TestClient) -> str:
    email = f"p9life-{uuid.uuid4().hex}@example.com"
    reg = client.post(
        "/v1/auth/register",
        json={
            "email": email,
            "password": "longpassword123",
            "full_name": "Phase9 Life Tester",
        },
    )
    assert reg.status_code == 200, reg.text
    return reg.json()["access_token"]


def _unique_cnpj() -> str:
    digits = f"{uuid.uuid4().int % 10**14:014d}"
    return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}"


# ---------------------------------------------------------------------------
# Preview
# ---------------------------------------------------------------------------


def test_preview_life_proposal_does_not_create_anything(client: TestClient) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/v1/me", headers=headers)
    user_id = me.json()["user"]["id"]

    qn = f"P9L-PREV-{uuid.uuid4().hex[:8].upper()}"
    body = {
        "source": "tokio_life_json_v1",
        "payload": _tokio_life_payload(quote_number=qn, cnpj=_unique_cnpj()),
        "owner_id": user_id,
        "create_lead_if_missing": True,
    }

    before = client.get("/v1/opportunities", headers=headers, params={"limit": 100})
    n_before = len(before.json())

    pv = client.post("/v1/proposals/auto/preview", headers=headers, json=body)
    assert pv.status_code == 200, pv.text
    pvj = pv.json()
    assert pvj["payload"] is not None
    assert pvj["opportunity_id"] is None
    assert pvj["would_create_lead"] is True
    assert pvj["payload"]["insurance_line"] == ProductCategory.LIFE_INSURANCE.value
    # Life payloads do not have `vehicle`, but DO carry `group` and
    # `coverage_items` blocks.
    assert pvj["payload"]["group"] is not None
    assert pvj["payload"]["group"]["lives_count"] == 2
    assert len(pvj["payload"]["coverage_items"]) == 2
    assert "vehicle" not in pvj["payload"]

    after = client.get("/v1/opportunities", headers=headers, params={"limit": 100})
    assert len(after.json()) == n_before


# ---------------------------------------------------------------------------
# Commit + idempotency + party kind
# ---------------------------------------------------------------------------


def test_commit_life_proposal_creates_lead_and_opportunity_then_idempotent(
    client: TestClient,
) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/v1/me", headers=headers)
    user_id = me.json()["user"]["id"]

    qn = f"P9L-COMMIT-{uuid.uuid4().hex[:8].upper()}"
    body = {
        "source": "tokio_life_json_v1",
        "payload": _tokio_life_payload(quote_number=qn, cnpj=_unique_cnpj()),
        "owner_id": user_id,
        "create_lead_if_missing": True,
    }

    c1 = client.post("/v1/proposals/auto/commit", headers=headers, json=body)
    assert c1.status_code == 200, c1.text
    j1 = c1.json()
    assert j1["applied"] is True
    assert j1["opportunity_id"] is not None
    assert j1["party_kind"] == "lead"
    assert j1["payload"]["insurance_line"] == ProductCategory.LIFE_INSURANCE.value
    assert j1["proposal_source"] == "tokio_life_json_v1"
    opp_id_1 = j1["opportunity_id"]
    party_id_1 = j1["party_id"]

    # Re-commit the same payload → idempotent (same opportunity & party).
    c2 = client.post("/v1/proposals/auto/commit", headers=headers, json=body)
    assert c2.status_code == 200, c2.text
    j2 = c2.json()
    assert j2["opportunity_id"] == opp_id_1
    assert j2["party_id"] == party_id_1


def test_commit_life_proposal_persists_canonical_envelope_on_opportunity(
    client: TestClient,
) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/v1/me", headers=headers)
    user_id = me.json()["user"]["id"]

    qn = f"P9L-DETAIL-{uuid.uuid4().hex[:8].upper()}"
    body = {
        "source": "tokio_life_json_v1",
        "payload": _tokio_life_payload(quote_number=qn, cnpj=_unique_cnpj()),
        "owner_id": user_id,
        "create_lead_if_missing": True,
    }
    res = client.post("/v1/proposals/auto/commit", headers=headers, json=body)
    assert res.status_code == 200, res.text
    opp_id = res.json()["opportunity_id"]

    detail = client.get(f"/v1/opportunities/{opp_id}", headers=headers)
    assert detail.status_code == 200, detail.text
    body_out = detail.json()

    assert body_out["insurance_line"] == ProductCategory.LIFE_INSURANCE.value
    assert body_out["proposal_source"] == "tokio_life_json_v1"
    assert body_out["preferred_insurer_name"] == "Tokio Marine Seguradora S.A."
    assert body_out["quote_number"] == qn
    proposal = body_out["proposal_data"]
    assert proposal is not None
    # Life-specific blocks survive the round trip.
    assert proposal["group"]["lives_count"] == 2
    assert {c["code"] for c in proposal["coverage_items"]} == {"BASICA_MORTE", "IEA"}
    # No vehicle/mobility shenanigans on a life payload.
    assert "vehicle" not in proposal
    # Coverage adequacy is empty when the opportunity has no linked product.
    assert body_out.get("coverage_adequacy", []) == []


# ---------------------------------------------------------------------------
# Line-neutral aliases (`/v1/proposals/preview` and `/commit`)
# ---------------------------------------------------------------------------


def test_neutral_alias_routes_accept_life_payloads(client: TestClient) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/v1/me", headers=headers)
    user_id = me.json()["user"]["id"]

    qn = f"P9L-NEUTRAL-{uuid.uuid4().hex[:8].upper()}"
    body = {
        "source": "tokio_life_json_v1",
        "payload": _tokio_life_payload(quote_number=qn, cnpj=_unique_cnpj()),
        "owner_id": user_id,
        "create_lead_if_missing": True,
    }

    pv = client.post("/v1/proposals/preview", headers=headers, json=body)
    assert pv.status_code == 200, pv.text
    assert pv.json()["payload"]["insurance_line"] == ProductCategory.LIFE_INSURANCE.value

    c = client.post("/v1/proposals/commit", headers=headers, json=body)
    assert c.status_code == 200, c.text
    assert c.json()["applied"] is True
    assert c.json()["party_kind"] == "lead"


# ---------------------------------------------------------------------------
# Mobility merge does NOT happen for Life
# ---------------------------------------------------------------------------


def test_commit_life_proposal_does_not_touch_mobility_block(
    client: TestClient,
) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/v1/me", headers=headers)
    user_id = me.json()["user"]["id"]

    qn = f"P9L-NOMOB-{uuid.uuid4().hex[:8].upper()}"
    body = {
        "source": "tokio_life_json_v1",
        "payload": _tokio_life_payload(quote_number=qn, cnpj=_unique_cnpj()),
        "owner_id": user_id,
        "create_lead_if_missing": True,
    }
    res = client.post("/v1/proposals/auto/commit", headers=headers, json=body)
    assert res.status_code == 200, res.text
    body_out = res.json()
    party_id = body_out["party_id"]

    lead_detail = client.get(f"/v1/leads/{party_id}", headers=headers)
    assert lead_detail.status_code == 200, lead_detail.text
    profile = lead_detail.json().get("profile_data") or {}
    assert "mobility" not in profile


# ---------------------------------------------------------------------------
# Validation: malformed life payload still returns a clean 422
# ---------------------------------------------------------------------------


def test_commit_life_proposal_with_missing_required_fields_returns_422(
    client: TestClient,
) -> None:
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/v1/me", headers=headers)
    user_id = me.json()["user"]["id"]

    payload = deepcopy(
        _tokio_life_payload(
            quote_number=f"P9L-INVALID-{uuid.uuid4().hex[:6]}",
            cnpj=_unique_cnpj(),
        ),
    )
    # Drop the company tax id → applicant.tax_id will be empty after
    # adapter normalization → canonical validation fails on min_length=11.
    payload["proposta_seguro_vida"]["estipulante"]["cnpj"] = ""
    body = {
        "source": "tokio_life_json_v1",
        "payload": payload,
        "owner_id": user_id,
        "create_lead_if_missing": True,
    }
    res = client.post("/v1/proposals/auto/commit", headers=headers, json=body)
    assert res.status_code == 422, res.text
    detail = res.json()["detail"]
    assert detail["code"] == "CANONICAL_VALIDATION_ERROR"
    assert any(
        "applicant" in err.get("loc", [])
        or err.get("loc", [])[:1] == ["applicant"]
        for err in detail["errors"]
    )
