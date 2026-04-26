"""Organization currency (ISO 4217)

Revision ID: org_currency_026
Revises: documents_versioning_025
Create Date: 2026-04-26

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "org_currency_026"
down_revision: str | Sequence[str] | None = "documents_versioning_025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="BRL"),
    )


def downgrade() -> None:
    op.drop_column("organizations", "currency")

