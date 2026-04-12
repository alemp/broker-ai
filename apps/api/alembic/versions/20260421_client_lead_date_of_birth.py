"""Add date_of_birth to clients and leads."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "client_lead_dob_018"
down_revision = "lead_client_parity_017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("date_of_birth", sa.Date(), nullable=True))
    op.add_column("leads", sa.Column("date_of_birth", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("leads", "date_of_birth")
    op.drop_column("clients", "date_of_birth")
