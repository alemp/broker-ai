"""Rename MVP Auto (Motor) display label to Auto

Revision ID: rename_auto_display_013
Revises: modules_56_59_012
Create Date: 2026-04-14

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "rename_auto_display_013"
down_revision: str | Sequence[str] | None = "modules_56_59_012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_MVP_TAG = "mvp_catalog_v1"


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE lines_of_business lob
            SET name = 'Auto'
            FROM organizations o
            WHERE lob.organization_id = o.id
              AND o.slug = 'default'
              AND lob.code = 'MOTOR'
              AND lob.name = 'Auto (Motor)'
            """
        ),
    )
    op.execute(
        sa.text(
            f"""
            UPDATE products p
            SET name = 'Auto'
            FROM organizations o
            WHERE p.organization_id = o.id
              AND o.slug = 'default'
              AND p.target_tags = '{_MVP_TAG}'
              AND p.category = 'AUTO_INSURANCE'
              AND p.name = 'Auto (Motor)'
            """
        ),
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE lines_of_business lob
            SET name = 'Auto (Motor)'
            FROM organizations o
            WHERE lob.organization_id = o.id
              AND o.slug = 'default'
              AND lob.code = 'MOTOR'
              AND lob.name = 'Auto'
            """
        ),
    )
    op.execute(
        sa.text(
            f"""
            UPDATE products p
            SET name = 'Auto (Motor)'
            FROM organizations o
            WHERE p.organization_id = o.id
              AND o.slug = 'default'
              AND p.target_tags = '{_MVP_TAG}'
              AND p.category = 'AUTO_INSURANCE'
              AND p.name = 'Auto'
            """
        ),
    )
