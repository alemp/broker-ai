"""PRODUCT §5.6 — optional product_line (linha de produto) on catalog products

Revision ID: product_line_catalog_020
Revises: recommendation_runs_lead_019
Create Date: 2026-04-23

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "product_line_catalog_020"
down_revision: str | Sequence[str] | None = "recommendation_runs_lead_019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("product_line", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("products", "product_line")
