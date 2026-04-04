"""Drop PENSION, INVESTMENT, OTHER from product category usage in DB

Revision ID: trim_product_cat_008
Revises: mvp_catalog_007
Create Date: 2026-04-09

Remaps existing rows so varchar values stay valid for the trimmed ProductCategory enum.
Downgrade restores only the known phase-2 seed product name for PENSION.

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "trim_product_cat_008"
down_revision: str | Sequence[str] | None = "mvp_catalog_007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Pension products → life; investment & catch-all → general
    op.execute(
        sa.text("UPDATE products SET category = 'LIFE_INSURANCE' WHERE category = 'PENSION'"),
    )
    op.execute(
        sa.text(
            "UPDATE products SET category = 'GENERAL_INSURANCE' "
            "WHERE category IN ('INVESTMENT', 'OTHER')"
        ),
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE products
            SET category = 'PENSION'
            WHERE name = 'Private pension plan' AND category = 'LIFE_INSURANCE'
            """
        ),
    )
