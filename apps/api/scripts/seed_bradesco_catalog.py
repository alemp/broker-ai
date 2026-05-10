"""Seed Bradesco insurer + product + coverage taxonomy (Phase 7).

The seed is **idempotent** and **tenant-aware**: it picks an organization
(by ``--org-slug`` or ``--org-id``) and ensures the canonical Bradesco AUTO
catalog exists, plus the nine `CoverageTaxonomy` entries used by
:mod:`ai_copilot_api.domain.coverage_normalization`.

Re-running the script never produces duplicates: existing rows are updated
in place when the seed is missing fields, and untouched when the seed
matches what's already stored.

CLI usage (host with ``DATABASE_URL`` exported, or inside the API container):

.. code-block:: bash

    DATABASE_URL=postgresql+psycopg://... \\
        uv run python apps/api/scripts/seed_bradesco_catalog.py --org-slug default

The script can also be imported by tests via :func:`seed_bradesco_catalog`.
"""

from __future__ import annotations

import argparse
import os
import sys
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

# When invoked as ``python apps/api/scripts/seed_bradesco_catalog.py`` we are
# outside the package's ``src`` layout, so add it to ``sys.path`` *before*
# importing application modules. When imported (e.g. via the tests) the
# package is already on the path so this is a no-op.
_SRC = Path(__file__).resolve().parents[1] / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from ai_copilot_api.db.enums import ProductCategory, ProductRiskLevel  # noqa: E402
from ai_copilot_api.db.models import (  # noqa: E402
    CoverageTaxonomy,
    Insurer,
    Organization,
    Product,
)
from ai_copilot_api.db.session import new_session  # noqa: E402

# ---------------------------------------------------------------------------
# Seed data — single source of truth for the Phase 7 catalog
# ---------------------------------------------------------------------------

BRADESCO_INSURER_NAME = "Bradesco Auto/RE Companhia de Seguros"
BRADESCO_INSURER_CODE = "BRADESCO"

BRADESCO_AUTO_PRIME_NAME = "BRADESCO SEGURO AUTO PRIME"


@dataclass(frozen=True)
class CoverageSeed:
    code: str
    label: str
    synonyms: tuple[str, ...] = field(default_factory=tuple)


# Bradesco Auto Prime — codes referenced by ``proposal_data.clauses[].code``.
# Synonyms include the canonical English key (used by `coverage_normalization`)
# and the most common pt-BR phrasings observed in Bradesco PDFs.
COVERAGE_TAXONOMY_SEEDS: tuple[CoverageSeed, ...] = (
    CoverageSeed(
        code="001",
        label="Cobertura Compreensiva",
        synonyms=(
            "comprehensive_coverage",
            "compreensiva",
            "casco compreensiva",
        ),
    ),
    CoverageSeed(
        code="006",
        label="Extensão de Cobertura - Mercosul",
        synonyms=(
            "mercosur_extension",
            "mercosul",
            "extensao mercosul",
        ),
    ),
    CoverageSeed(
        code="024",
        label="Vidros - Cobertura Plus",
        synonyms=(
            "glass_coverage_plus",
            "vidros plus",
            "cobertura de vidros",
        ),
    ),
    CoverageSeed(
        code="038",
        label="Valor de Mercado Referenciado",
        synonyms=(
            "market_referenced_value",
            "valor referenciado",
            "valor de mercado",
        ),
    ),
    CoverageSeed(
        code="056",
        label="Danos Morais",
        synonyms=(
            "moral_damages",
            "danos morais",
            "moral",
        ),
    ),
    CoverageSeed(
        code="081",
        label="APP - Acidentes Pessoais por Passageiro",
        synonyms=(
            "accidental_passengers",
            "app passageiros",
            "acidentes pessoais passageiros",
        ),
    ),
    CoverageSeed(
        code="106",
        label="Assistência 24h - Passeio",
        synonyms=(
            "roadside_assistance_24h",
            "assistencia 24h",
            "assist 24 horas",
        ),
    ),
    CoverageSeed(
        code="115",
        label="Carro Reserva",
        synonyms=(
            "courtesy_car",
            "carro reserva",
            "veiculo reserva",
        ),
    ),
    CoverageSeed(
        code="157",
        label="Despesas Médico-Hospitalares",
        synonyms=(
            "medical_hospital_expenses",
            "despesas medicas",
            "despesas medico hospitalares",
        ),
    ),
)


@dataclass
class SeedReport:
    """Summary of what changed during a seed run (for logging + tests)."""

    organization_id: uuid.UUID
    insurer_created: bool = False
    insurer_updated: bool = False
    product_created: bool = False
    product_updated: bool = False
    taxonomy_created: int = 0
    taxonomy_updated: int = 0

    def as_dict(self) -> dict[str, Any]:
        return {
            "organization_id": str(self.organization_id),
            "insurer_created": self.insurer_created,
            "insurer_updated": self.insurer_updated,
            "product_created": self.product_created,
            "product_updated": self.product_updated,
            "taxonomy_created": self.taxonomy_created,
            "taxonomy_updated": self.taxonomy_updated,
        }


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------


def _upsert_insurer(db: Session, organization_id: uuid.UUID, report: SeedReport) -> Insurer:
    """Ensure the Bradesco insurer exists for ``organization_id``.

    The match is case-insensitive on ``name`` (mirrors :func:`resolve_insurer`)
    and the resulting row carries the canonical ``code`` so :class:`Insurer`'s
    ``(organization_id, code)`` unique constraint is honored across re-runs.
    """
    row = db.scalar(
        select(Insurer).where(
            Insurer.organization_id == organization_id,
            Insurer.name.ilike(BRADESCO_INSURER_NAME),
        ),
    )
    if row is None:
        row = db.scalar(
            select(Insurer).where(
                Insurer.organization_id == organization_id,
                Insurer.code == BRADESCO_INSURER_CODE,
            ),
        )

    desired_name = BRADESCO_INSURER_NAME
    desired_code = BRADESCO_INSURER_CODE

    if row is None:
        row = Insurer(
            organization_id=organization_id,
            name=desired_name,
            code=desired_code,
            active=True,
        )
        db.add(row)
        db.flush()
        report.insurer_created = True
        return row

    changed = False
    if row.name != desired_name:
        row.name = desired_name
        changed = True
    if row.code != desired_code:
        row.code = desired_code
        changed = True
    if not row.active:
        row.active = True
        changed = True
    if changed:
        report.insurer_updated = True
        db.flush()
    return row


def _bradesco_auto_prime_coverages() -> list[dict[str, str]]:
    """Default ``Product.additional_coverages`` payload for the Auto Prime product."""
    return [
        {"code": seed.code, "label": seed.label}
        for seed in COVERAGE_TAXONOMY_SEEDS
    ]


def _upsert_product(
    db: Session,
    organization_id: uuid.UUID,
    insurer: Insurer,
    report: SeedReport,
) -> Product:
    """Ensure the Bradesco Auto Prime product exists and points at the seeded insurer."""
    row = db.scalar(
        select(Product).where(
            Product.organization_id == organization_id,
            Product.category == ProductCategory.AUTO_INSURANCE,
            Product.name.ilike(BRADESCO_AUTO_PRIME_NAME),
        ),
    )
    desired_coverages = _bradesco_auto_prime_coverages()

    if row is None:
        row = Product(
            organization_id=organization_id,
            name=BRADESCO_AUTO_PRIME_NAME,
            category=ProductCategory.AUTO_INSURANCE,
            risk_level=ProductRiskLevel.MEDIUM,
            insurer_id=insurer.id,
            active=True,
            additional_coverages=desired_coverages,
            main_coverage_summary=(
                "Cobertura compreensiva (colisão, incêndio, roubo/furto), "
                "RC-V (danos materiais, corporais e morais), APP por passageiro, "
                "assistência 24h e carro reserva conforme contratação."
            ),
        )
        db.add(row)
        db.flush()
        report.product_created = True
        return row

    changed = False
    if row.name != BRADESCO_AUTO_PRIME_NAME:
        row.name = BRADESCO_AUTO_PRIME_NAME
        changed = True
    if row.category != ProductCategory.AUTO_INSURANCE:
        row.category = ProductCategory.AUTO_INSURANCE
        changed = True
    if row.insurer_id != insurer.id:
        row.insurer_id = insurer.id
        changed = True
    if row.risk_level != ProductRiskLevel.MEDIUM:
        row.risk_level = ProductRiskLevel.MEDIUM
        changed = True
    if not row.active:
        row.active = True
        changed = True
    existing_codes = {
        str((c or {}).get("code") or "")
        for c in (row.additional_coverages or [])
        if isinstance(c, dict)
    }
    desired_codes = {c["code"] for c in desired_coverages}
    if existing_codes != desired_codes:
        row.additional_coverages = desired_coverages
        changed = True
    if changed:
        report.product_updated = True
        db.flush()
    return row


def _upsert_taxonomy(
    db: Session,
    organization_id: uuid.UUID,
    report: SeedReport,
) -> list[CoverageTaxonomy]:
    """Ensure each :class:`CoverageTaxonomy` entry exists with the seeded synonyms.

    The unique constraint ``(organization_id, code)`` lets us upsert by code.
    Synonym lists are merged (existing custom synonyms preserved + seed
    synonyms added) so admin tweaks via the taxonomy UI are not clobbered.
    """
    out: list[CoverageTaxonomy] = []
    for seed in COVERAGE_TAXONOMY_SEEDS:
        row = db.scalar(
            select(CoverageTaxonomy).where(
                CoverageTaxonomy.organization_id == organization_id,
                CoverageTaxonomy.code == seed.code,
            ),
        )
        if row is None:
            row = CoverageTaxonomy(
                organization_id=organization_id,
                code=seed.code,
                label=seed.label,
                synonyms=list(seed.synonyms),
                active=True,
            )
            db.add(row)
            db.flush()
            report.taxonomy_created += 1
            out.append(row)
            continue

        changed = False
        if row.label != seed.label:
            row.label = seed.label
            changed = True
        if not row.active:
            row.active = True
            changed = True

        existing_synonyms = [str(s) for s in (row.synonyms or []) if isinstance(s, str)]
        merged: list[str] = list(existing_synonyms)
        for syn in seed.synonyms:
            if syn not in merged:
                merged.append(syn)
        if merged != existing_synonyms:
            row.synonyms = merged
            changed = True
        if changed:
            report.taxonomy_updated += 1
            db.flush()
        out.append(row)
    return out


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def seed_bradesco_catalog(
    db: Session,
    *,
    organization_id: uuid.UUID,
) -> SeedReport:
    """Idempotently seed Bradesco insurer/product + coverage taxonomy for a tenant.

    The caller owns the surrounding transaction (the function flushes but
    does NOT commit). This keeps the helper safe to use from tests inside a
    rollback-only fixture and from the CLI which commits at the end.
    """
    report = SeedReport(organization_id=organization_id)
    insurer = _upsert_insurer(db, organization_id, report)
    _upsert_product(db, organization_id, insurer, report)
    _upsert_taxonomy(db, organization_id, report)
    return report


def _resolve_organization(
    db: Session,
    *,
    org_id: uuid.UUID | None,
    org_slug: str | None,
) -> Organization:
    if org_id is not None:
        org = db.get(Organization, org_id)
        if org is None:
            raise SystemExit(f"Organization with id={org_id} not found")
        return org
    slug = (org_slug or os.environ.get("DEFAULT_ORGANIZATION_SLUG") or "default").strip()
    org = db.scalar(select(Organization).where(Organization.slug == slug))
    if org is None:
        raise SystemExit(f"Organization with slug={slug!r} not found")
    return org


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Seed Bradesco catalog (insurer, product, coverage taxonomy).",
    )
    parser.add_argument("--org-slug", default=None, help="Target organization slug.")
    parser.add_argument(
        "--org-id",
        default=None,
        help="Target organization id (UUID). Takes precedence over --org-slug.",
    )
    args = parser.parse_args(argv)

    org_id: uuid.UUID | None = None
    if args.org_id:
        try:
            org_id = uuid.UUID(args.org_id)
        except ValueError as exc:  # pragma: no cover - argparse-style failure
            raise SystemExit(f"Invalid --org-id: {exc}") from exc

    db = new_session()
    try:
        org = _resolve_organization(db, org_id=org_id, org_slug=args.org_slug)
        org_slug_snapshot = org.slug
        org_id_snapshot = org.id
        report = seed_bradesco_catalog(db, organization_id=org.id)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print(  # noqa: T201 — admin script, stdout is the contract
        "Bradesco catalog seeded for organization "
        f"{org_slug_snapshot!r} (id={org_id_snapshot}): {report.as_dict()}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
