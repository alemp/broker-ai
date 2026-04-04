"""MVP catalog — Auto, Ramos elementares, Vida (Life)

Revision ID: mvp_catalog_007
Revises: module52_006
Create Date: 2026-04-08

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "mvp_catalog_007"
down_revision: str | Sequence[str] | None = "module52_006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_MVP_TAG = "mvp_catalog_v1"


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE lines_of_business lob
            SET name = 'Auto',
                description = 'Seguros automóveis — âmbito MVP.'
            FROM organizations o
            WHERE lob.organization_id = o.id
              AND o.slug = 'default'
              AND lob.code = 'MOTOR'
            """
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE lines_of_business lob
            SET name = 'Vida (Life)',
                description = 'Seguros de vida — âmbito MVP.'
            FROM organizations o
            WHERE lob.organization_id = o.id
              AND o.slug = 'default'
              AND lob.code = 'LIFE'
            """
        ),
    )
    op.execute(
        sa.text(
            """
            INSERT INTO lines_of_business (organization_id, code, name, description)
            SELECT id, 'GENERAL', 'Ramos elementares',
                   'Seguros gerais / multirisco, RC, danos, acidentes pessoais — âmbito MVP.'
            FROM organizations WHERE slug = 'default' LIMIT 1
            ON CONFLICT ON CONSTRAINT uq_lines_of_business_org_code DO NOTHING
            """
        ),
    )
    op.execute(
        sa.text(
            """
            DELETE FROM lines_of_business lob
            WHERE lob.code = 'HEALTH'
              AND lob.organization_id = (
                SELECT id FROM organizations WHERE slug = 'default' LIMIT 1
              )
              AND NOT EXISTS (
                SELECT 1 FROM client_lines_of_business cl
                WHERE cl.line_of_business_id = lob.id
              )
            """
        ),
    )
    op.execute(
        sa.text(
            f"""
            INSERT INTO products (
                organization_id, name, category, description,
                risk_level, target_tags, active
            )
            SELECT o.id, v.name, v.category, v.description, v.risk, '{_MVP_TAG}', true
            FROM organizations o
            CROSS JOIN (VALUES
                ('Auto', 'AUTO_INSURANCE', 'Catálogo MVP — automóvel', 'MEDIUM'),
                (
                  'Ramos elementares', 'GENERAL_INSURANCE',
                  'Catálogo MVP — multirisco / danos / RC', 'MEDIUM'
                ),
                ('Vida (Life)', 'LIFE_INSURANCE', 'Catálogo MVP — vida', 'MEDIUM')
            ) AS v(name, category, description, risk)
            WHERE o.slug = 'default'
              AND NOT EXISTS (
                SELECT 1 FROM products p
                WHERE p.organization_id = o.id AND p.target_tags = '{_MVP_TAG}'
              )
            """
        ),
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            f"""
            DELETE FROM products p
            USING organizations o
            WHERE p.organization_id = o.id
              AND o.slug = 'default'
              AND p.target_tags = '{_MVP_TAG}'
            """
        ),
    )
    op.execute(
        sa.text(
            """
            DELETE FROM lines_of_business lob
            WHERE lob.code = 'GENERAL'
              AND lob.organization_id = (
                SELECT id FROM organizations WHERE slug = 'default' LIMIT 1
              )
              AND NOT EXISTS (
                SELECT 1 FROM client_lines_of_business cl
                WHERE cl.line_of_business_id = lob.id
              )
            """
        ),
    )
    op.execute(
        sa.text(
            """
            INSERT INTO lines_of_business (organization_id, code, name, description)
            SELECT id, 'HEALTH', 'Health', 'Health insurance line'
            FROM organizations WHERE slug = 'default' LIMIT 1
            ON CONFLICT ON CONSTRAINT uq_lines_of_business_org_code DO NOTHING
            """
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE lines_of_business lob
            SET name = 'Motor',
                description = 'Automotive line'
            FROM organizations o
            WHERE lob.organization_id = o.id
              AND o.slug = 'default'
              AND lob.code = 'MOTOR'
            """
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE lines_of_business lob
            SET name = 'Life',
                description = 'Life insurance line'
            FROM organizations o
            WHERE lob.organization_id = o.id
              AND o.slug = 'default'
              AND lob.code = 'LIFE'
            """
        ),
    )
