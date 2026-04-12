"""Recommendation runs may attach to a lead (XOR client).

Revision ID: recommendation_runs_lead_019
Revises: client_lead_dob_018
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "recommendation_runs_lead_019"
down_revision: str | Sequence[str] | None = "client_lead_dob_018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "recommendation_runs",
        sa.Column("lead_id", sa.Uuid(), nullable=True),
    )
    op.create_index(
        op.f("ix_recommendation_runs_lead_id"),
        "recommendation_runs",
        ["lead_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_recommendation_runs_lead_id_leads",
        "recommendation_runs",
        "leads",
        ["lead_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.alter_column("recommendation_runs", "client_id", existing_type=sa.Uuid(), nullable=True)
    op.create_check_constraint(
        "ck_recommendation_runs_client_xor_lead",
        "recommendation_runs",
        "(client_id IS NOT NULL)::int + (lead_id IS NOT NULL)::int = 1",
    )


def downgrade() -> None:
    op.drop_constraint("ck_recommendation_runs_client_xor_lead", "recommendation_runs", type_="check")
    op.alter_column("recommendation_runs", "client_id", existing_type=sa.Uuid(), nullable=False)
    op.drop_constraint("fk_recommendation_runs_lead_id_leads", "recommendation_runs", type_="foreignkey")
    op.drop_index(op.f("ix_recommendation_runs_lead_id"), table_name="recommendation_runs")
    op.drop_column("recommendation_runs", "lead_id")
