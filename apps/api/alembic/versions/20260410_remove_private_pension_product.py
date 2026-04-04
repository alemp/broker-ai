"""Remove Private pension plan catalog product

Revision ID: remove_private_pension_009
Revises: trim_product_cat_008
Create Date: 2026-04-10

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "remove_private_pension_009"
down_revision: str | Sequence[str] | None = "trim_product_cat_008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(sa.text("DELETE FROM products WHERE name = 'Private pension plan'"))


def downgrade() -> None:
    # Product intentionally removed from the catalog; no automatic restore.
    pass
