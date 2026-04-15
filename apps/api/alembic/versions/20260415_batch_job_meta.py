"""Add job_meta to batch_job_runs for async workflows

Revision ID: batch_job_meta_023
Revises: extraction_taxonomy_022
Create Date: 2026-04-15

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "batch_job_meta_023"
down_revision: str | Sequence[str] | None = "extraction_taxonomy_022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "batch_job_runs",
        sa.Column(
            "job_meta",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("batch_job_runs", "job_meta")

