"""Phase 9 — coverage-level adequacy.

Validates the deliverables in `docs/PROPOSAL-INGEST-IMPLEMENTATION.md` Phase 9:

- :func:`assess_coverage_adequacy` reports a per-coverage traffic light by
  matching the linked ``Product.additional_coverages`` against
  ``Opportunity.proposal_data.clauses[]`` (exact code or synonym match).
- ``GET /v1/opportunities/{opp_id}`` surfaces the assessment under
  ``coverage_adequacy[]`` so the web layer can render a per-coverage UI.
"""

from __future__ import annotations

import importlib.util
import os
import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL is required for coverage adequacy integration tests",
)


def _import_seed_module():
    seed_path = Path(__file__).resolve().parents[1] / "scripts" / "seed_bradesco_catalog.py"
    spec = importlib.util.spec_from_file_location("seed_bradesco_catalog", seed_path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules.setdefault("seed_bradesco_catalog", mod)
    spec.loader.exec_module(mod)
    return mod


_SEED = _import_seed_module()


# ---------------------------------------------------------------------------
# Pure unit tests on the domain helper (no DB / API)
# ---------------------------------------------------------------------------


def _make_taxonomy() -> list[dict[str, object]]:
    return [
        {"code": s.code, "label": s.label, "synonyms": list(s.synonyms)}
        for s in _SEED.COVERAGE_TAXONOMY_SEEDS
    ]


def _make_product_with_coverages(codes: list[str]):
    from ai_copilot_api.db.enums import ProductCategory, ProductRiskLevel
    from ai_copilot_api.db.models import Product

    return Product(
        id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        name="Test Auto Product",
        category=ProductCategory.AUTO_INSURANCE,
        risk_level=ProductRiskLevel.MEDIUM,
        active=True,
        additional_coverages=[
            {"code": code, "label": next(
                (s.label for s in _SEED.COVERAGE_TAXONOMY_SEEDS if s.code == code),
                code,
            )}
            for code in codes
        ],
    )


def _make_opportunity_with_clauses(clauses: list[dict[str, str]]):
    from ai_copilot_api.db.enums import OpportunityStage, OpportunityStatus, ProductCategory
    from ai_copilot_api.db.models import Opportunity

    return Opportunity(
        id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        insurance_line=ProductCategory.AUTO_INSURANCE,
        stage=OpportunityStage.LEAD,
        status=OpportunityStatus.OPEN,
        closing_probability=10,
        proposal_data={"clauses": clauses},
    )


def test_assess_returns_green_on_exact_code_match() -> None:
    from ai_copilot_api.db.enums import AdequacyTrafficLight
    from ai_copilot_api.domain.coverage_adequacy import assess_coverage_adequacy

    product = _make_product_with_coverages(["001", "106"])
    opp = _make_opportunity_with_clauses(
        [
            {"code": "001", "description": "Cobertura Compreensiva"},
            {"code": "106", "description": "Assistência 24h"},
        ],
    )

    items = assess_coverage_adequacy(
        opportunity=opp,
        product=product,
        taxonomy=_make_taxonomy(),
    )

    by_code = {i.code: i for i in items}
    assert {i.code for i in items} == {"001", "106"}
    for code in ("001", "106"):
        assert by_code[code].status == AdequacyTrafficLight.GREEN
        assert by_code[code].matched_clause_code == code
        assert by_code[code].match_confidence == 100
        assert by_code[code].reason == "exact_code_match"


def test_assess_returns_red_on_missing_coverage() -> None:
    from ai_copilot_api.db.enums import AdequacyTrafficLight
    from ai_copilot_api.domain.coverage_adequacy import assess_coverage_adequacy

    product = _make_product_with_coverages(["001", "115"])
    opp = _make_opportunity_with_clauses(
        [{"code": "001", "description": "Cobertura Compreensiva"}],
    )

    items = assess_coverage_adequacy(
        opportunity=opp,
        product=product,
        taxonomy=_make_taxonomy(),
    )
    by_code = {i.code: i for i in items}

    assert by_code["001"].status == AdequacyTrafficLight.GREEN
    missing = by_code["115"]
    assert missing.status == AdequacyTrafficLight.RED
    assert missing.matched_clause_code is None
    assert missing.matched_clause_description is None
    assert missing.match_confidence == 0
    assert missing.reason == "missing"


def test_assess_matches_via_synonym_when_code_differs() -> None:
    from ai_copilot_api.db.enums import AdequacyTrafficLight
    from ai_copilot_api.domain.coverage_adequacy import assess_coverage_adequacy

    product = _make_product_with_coverages(["001", "106"])
    # Clauses with non-matching codes but descriptions that hit the taxonomy:
    #   - 001 picks up via the canonical label ("Cobertura Compreensiva") -> strong (GREEN).
    #   - 106 picks up via partial overlap with the long Bradesco label    -> moderate (YELLOW).
    opp = _make_opportunity_with_clauses(
        [
            {"code": "AUX1", "description": "Cobertura Compreensiva"},
            {"code": "AUX2", "description": "Assistência 24h"},
        ],
    )

    items = assess_coverage_adequacy(
        opportunity=opp,
        product=product,
        taxonomy=_make_taxonomy(),
    )
    by_code = {i.code: i for i in items}

    strong = by_code["001"]
    assert strong.status == AdequacyTrafficLight.GREEN
    assert strong.matched_clause_code is None
    assert strong.matched_clause_description == "Cobertura Compreensiva"
    assert strong.match_confidence >= 70
    assert strong.reason == "synonym_match_strong"

    moderate = by_code["106"]
    assert moderate.status == AdequacyTrafficLight.YELLOW
    assert moderate.matched_clause_code is None
    assert moderate.matched_clause_description == "Assistência 24h"
    assert 40 <= moderate.match_confidence < 70
    assert moderate.reason == "synonym_match_moderate"


def test_assess_returns_empty_when_no_expected_set() -> None:
    from ai_copilot_api.domain.coverage_adequacy import assess_coverage_adequacy

    opp = _make_opportunity_with_clauses(
        [{"code": "001", "description": "Cobertura Compreensiva"}],
    )

    items = assess_coverage_adequacy(
        opportunity=opp,
        product=None,
        taxonomy=_make_taxonomy(),
    )
    assert items == []

    product = _make_product_with_coverages([])
    items = assess_coverage_adequacy(
        opportunity=opp,
        product=product,
        taxonomy=_make_taxonomy(),
    )
    assert items == []


# ---------------------------------------------------------------------------
# Integration via the opportunities GET endpoint
# ---------------------------------------------------------------------------


def _register(client: TestClient) -> str:
    email = f"p9c-{uuid.uuid4().hex}@example.com"
    reg = client.post(
        "/v1/auth/register",
        json={"email": email, "password": "longpassword123", "full_name": "Phase9 Coverage Tester"},
    )
    assert reg.status_code == 200, reg.text
    return reg.json()["access_token"]


def test_opportunity_detail_includes_coverage_adequacy(client: TestClient) -> None:
    """End-to-end check: seed catalog → create opp → set proposal_data → GET shows semáforo."""
    from sqlalchemy import select

    from ai_copilot_api.db.models import Opportunity, Product
    from ai_copilot_api.db.session import new_session

    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/v1/me", headers=headers).json()
    user_id = me["user"]["id"]
    org_id = uuid.UUID(me["user"]["organization"]["id"])

    cli = client.post(
        "/v1/clients",
        headers=headers,
        json={
            "full_name": "Phase 9 Coverage Tester",
            "email": f"phase9-coverage-{uuid.uuid4().hex}@example.com",
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
            "next_action": "Cotação carro",
        },
    )
    assert opp.status_code == 201, opp.text
    opp_id = uuid.UUID(opp.json()["id"])

    db = new_session()
    try:
        _SEED.seed_bradesco_catalog(db, organization_id=org_id)
        product = db.scalar(
            select(Product).where(
                Product.organization_id == org_id,
                Product.name == _SEED.BRADESCO_AUTO_PRIME_NAME,
            ),
        )
        assert product is not None
        row = db.get(Opportunity, opp_id)
        assert row is not None
        row.product_id = product.id
        row.proposal_data = {
            "clauses": [
                {"code": "001", "description": "Cobertura Compreensiva"},
                {"code": "106", "description": "Assistência 24h"},
                # missing: 006, 024, 038, 056, 081, 115, 157
            ],
        }
        db.commit()
    finally:
        db.close()

    res = client.get(f"/v1/opportunities/{opp_id}", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()

    coverage = body.get("coverage_adequacy")
    assert isinstance(coverage, list)
    assert len(coverage) == len(_SEED.COVERAGE_TAXONOMY_SEEDS)
    by_code = {c["code"]: c for c in coverage}
    # Codes 001 and 106 are present in the proposal -> GREEN.
    assert by_code["001"]["status"] == "GREEN"
    assert by_code["106"]["status"] == "GREEN"
    # Other codes are missing -> RED.
    for missing_code in ("006", "024", "038", "056", "081", "115", "157"):
        assert by_code[missing_code]["status"] == "RED", missing_code


def test_opportunity_detail_no_coverage_when_proposal_empty(client: TestClient) -> None:
    """No `proposal_data` -> empty `coverage_adequacy` (UI keeps current behaviour)."""
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/v1/me", headers=headers).json()
    user_id = me["user"]["id"]

    cli = client.post(
        "/v1/clients",
        headers=headers,
        json={
            "full_name": "Phase 9 Coverage Client",
            "email": f"phase9-{uuid.uuid4().hex}@example.com",
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
            "stage": "LEAD",
            "status": "OPEN",
        },
    )
    assert opp.status_code == 201, opp.text
    opp_id = opp.json()["id"]

    res = client.get(f"/v1/opportunities/{opp_id}", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["coverage_adequacy"] == []
