"""Remove Term life baseline catalog product

Revision ID: remove_term_life_baseline_010
Revises: remove_private_pension_009
Create Date: 2026-04-11

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "remove_term_life_baseline_010"
down_revision: str | Sequence[str] | None = "remove_private_pension_009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(sa.text("DELETE FROM products WHERE name = 'Term life baseline'"))


def downgrade() -> None:
    # Product intentionally removed from the catalog; no automatic restore.
    pass
