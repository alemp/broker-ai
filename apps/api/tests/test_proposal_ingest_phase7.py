"""Phase 7 — Bradesco catalog + coverage taxonomy seed.

Validates the deliverables in `docs/PROPOSAL-INGEST-IMPLEMENTATION.md`:

- Running ``seed_bradesco_catalog`` is idempotent (a second run produces no
  changes) and yields the canonical insurer/product/coverage taxonomy.
- :func:`resolve_product` (used by the proposal apply pipeline) returns the
  seeded Bradesco AUTO product when the canonical payload references the
  carrier and product names verbatim.
"""

from __future__ import annotations

import importlib.util
import os
import sys
import uuid
from pathlib import Path

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL is required for catalog seed integration tests",
)


# The seed script lives at ``apps/api/scripts/seed_bradesco_catalog.py`` so it
# can be invoked as a standalone admin tool. We import it via importlib here
# instead of mutating ``sys.path`` permanently from the test file.
def _import_seed_module():
    seed_path = Path(__file__).resolve().parents[1] / "scripts" / "seed_bradesco_catalog.py"
    spec = importlib.util.spec_from_file_location("seed_bradesco_catalog", seed_path)
    assert spec is not None and spec.loader is not None, "seed module not found"
    mod = importlib.util.module_from_spec(spec)
    sys.modules.setdefault("seed_bradesco_catalog", mod)
    spec.loader.exec_module(mod)
    return mod


_SEED = _import_seed_module()


def _make_organization():
    """Create a fresh isolated org for the test (avoids cross-test contamination)."""
    from ai_copilot_api.db.models import Organization
    from ai_copilot_api.db.session import new_session

    db = new_session()
    try:
        slug = f"phase7-{uuid.uuid4().hex[:12]}"
        org = Organization(name=f"Phase7 Test Org {slug}", slug=slug)
        db.add(org)
        db.commit()
        db.refresh(org)
        return org.id
    finally:
        db.close()


def test_seed_bradesco_catalog_creates_full_set_then_idempotent() -> None:
    from sqlalchemy import select

    from ai_copilot_api.db.enums import ProductCategory
    from ai_copilot_api.db.models import CoverageTaxonomy, Insurer, Product
    from ai_copilot_api.db.session import new_session

    org_id = _make_organization()

    db = new_session()
    try:
        first = _SEED.seed_bradesco_catalog(db, organization_id=org_id)
        db.commit()
    finally:
        db.close()

    assert first.organization_id == org_id
    assert first.insurer_created is True
    assert first.product_created is True
    assert first.taxonomy_created == len(_SEED.COVERAGE_TAXONOMY_SEEDS) == 9
    assert first.taxonomy_updated == 0

    db = new_session()
    try:
        insurer = db.scalar(
            select(Insurer).where(
                Insurer.organization_id == org_id,
                Insurer.code == _SEED.BRADESCO_INSURER_CODE,
            ),
        )
        assert insurer is not None
        assert insurer.name == _SEED.BRADESCO_INSURER_NAME
        assert insurer.active is True

        product = db.scalar(
            select(Product).where(
                Product.organization_id == org_id,
                Product.name == _SEED.BRADESCO_AUTO_PRIME_NAME,
            ),
        )
        assert product is not None
        assert product.category == ProductCategory.AUTO_INSURANCE
        assert product.insurer_id == insurer.id
        codes = {c["code"] for c in (product.additional_coverages or [])}
        assert codes == {seed.code for seed in _SEED.COVERAGE_TAXONOMY_SEEDS}

        taxonomy = db.scalars(
            select(CoverageTaxonomy).where(CoverageTaxonomy.organization_id == org_id),
        ).all()
        assert {t.code for t in taxonomy} == {s.code for s in _SEED.COVERAGE_TAXONOMY_SEEDS}
        for t in taxonomy:
            seed = next(s for s in _SEED.COVERAGE_TAXONOMY_SEEDS if s.code == t.code)
            assert t.label == seed.label
            assert t.active is True
            for syn in seed.synonyms:
                assert syn in t.synonyms

        # Second run must be a true no-op (no new rows, no updates).
        second = _SEED.seed_bradesco_catalog(db, organization_id=org_id)
        db.commit()
    finally:
        db.close()

    assert second.insurer_created is False
    assert second.insurer_updated is False
    assert second.product_created is False
    assert second.product_updated is False
    assert second.taxonomy_created == 0
    assert second.taxonomy_updated == 0


def test_seed_preserves_admin_added_taxonomy_synonyms() -> None:
    """Admin-added synonyms via the taxonomy UI must NOT be clobbered by re-seeds."""
    from sqlalchemy import select

    from ai_copilot_api.db.models import CoverageTaxonomy
    from ai_copilot_api.db.session import new_session

    org_id = _make_organization()

    db = new_session()
    try:
        _SEED.seed_bradesco_catalog(db, organization_id=org_id)
        db.commit()

        row = db.scalar(
            select(CoverageTaxonomy).where(
                CoverageTaxonomy.organization_id == org_id,
                CoverageTaxonomy.code == "001",
            ),
        )
        assert row is not None
        custom = list(row.synonyms) + ["custom-broker-synonym"]
        row.synonyms = custom
        db.commit()

        report = _SEED.seed_bradesco_catalog(db, organization_id=org_id)
        db.commit()

        refreshed = db.scalar(
            select(CoverageTaxonomy).where(
                CoverageTaxonomy.organization_id == org_id,
                CoverageTaxonomy.code == "001",
            ),
        )
        assert refreshed is not None
        assert "custom-broker-synonym" in refreshed.synonyms
        assert report.taxonomy_updated == 0
        assert report.taxonomy_created == 0
    finally:
        db.close()


def test_resolve_product_returns_bradesco_after_seed() -> None:
    """Phase 7 acceptance: resolver matches the canonical payload against the seed."""
    from ai_copilot_api.db.enums import ProductCategory
    from ai_copilot_api.db.session import new_session
    from ai_copilot_api.domain.proposal_ingest import resolve_insurer, resolve_product

    org_id = _make_organization()

    db = new_session()
    try:
        _SEED.seed_bradesco_catalog(db, organization_id=org_id)
        db.commit()

        insurer = resolve_insurer(db, org_id, _SEED.BRADESCO_INSURER_NAME)
        assert insurer is not None
        assert insurer.code == _SEED.BRADESCO_INSURER_CODE

        product = resolve_product(
            db,
            org_id,
            insurer,
            _SEED.BRADESCO_AUTO_PRIME_NAME,
            ProductCategory.AUTO_INSURANCE,
        )
        assert product is not None
        assert product.name == _SEED.BRADESCO_AUTO_PRIME_NAME
        assert product.insurer_id == insurer.id

        # Case-insensitive name match — same payload formatted differently still resolves.
        lowered = resolve_product(
            db,
            org_id,
            insurer,
            "bradesco seguro auto prime",
            ProductCategory.AUTO_INSURANCE,
        )
        assert lowered is not None
        assert lowered.id == product.id

        # Wrong line returns nothing — guards against cross-line collisions.
        miss = resolve_product(
            db,
            org_id,
            insurer,
            _SEED.BRADESCO_AUTO_PRIME_NAME,
            ProductCategory.LIFE_INSURANCE,
        )
        assert miss is None
    finally:
        db.close()
