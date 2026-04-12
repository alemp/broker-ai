"""Phase 9 — batch adequacy snapshots and job run audit."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "phase9_adequacy_015"
down_revision = "phase5_import_014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "client_adequacy_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("traffic_light", sa.String(length=48), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column(
            "reasons",
            sa.dialects.postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("needs_human_review", sa.Boolean(), nullable=False),
        sa.Column("profile_completeness_score", sa.Integer(), nullable=False),
        sa.Column(
            "profile_alert_codes",
            sa.dialects.postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("inputs_hash", sa.String(length=64), nullable=False),
        sa.Column("rule_version", sa.String(length=32), nullable=False),
        sa.Column(
            "computed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("client_id", name="uq_client_adequacy_snapshots_client"),
    )
    op.create_index(
        op.f("ix_client_adequacy_snapshots_organization_id"),
        "client_adequacy_snapshots",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_client_adequacy_snapshots_client_id"),
        "client_adequacy_snapshots",
        ["client_id"],
        unique=False,
    )

    op.create_table(
        "batch_job_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("job_type", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=48), nullable=False),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("clients_processed", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_batch_job_runs_organization_id"),
        "batch_job_runs",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_batch_job_runs_org_type_finished",
        "batch_job_runs",
        ["organization_id", "job_type", "finished_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_batch_job_runs_org_type_finished", table_name="batch_job_runs")
    op.drop_index(op.f("ix_batch_job_runs_organization_id"), table_name="batch_job_runs")
    op.drop_table("batch_job_runs")
    op.drop_index(op.f("ix_client_adequacy_snapshots_client_id"), table_name="client_adequacy_snapshots")
    op.drop_index(
        op.f("ix_client_adequacy_snapshots_organization_id"),
        table_name="client_adequacy_snapshots",
    )
    op.drop_table("client_adequacy_snapshots")
