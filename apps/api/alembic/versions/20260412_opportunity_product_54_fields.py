"""PRODUCT §5.4 — insurer, expected close, loss reason; POST_SALE stage data

Revision ID: opp_product54_011
Revises: remove_term_life_baseline_010
Create Date: 2026-04-12

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "opp_product54_011"
down_revision: str | Sequence[str] | None = "remove_term_life_baseline_010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "opportunities",
        sa.Column("preferred_insurer_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "opportunities",
        sa.Column("expected_close_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "opportunities",
        sa.Column("loss_reason", sa.Text(), nullable=True),
    )
    op.create_index(
        op.f("ix_opportunities_expected_close_at"),
        "opportunities",
        ["expected_close_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_opportunities_expected_close_at"), table_name="opportunities")
    op.drop_column("opportunities", "loss_reason")
    op.drop_column("opportunities", "expected_close_at")
    op.drop_column("opportunities", "preferred_insurer_name")
