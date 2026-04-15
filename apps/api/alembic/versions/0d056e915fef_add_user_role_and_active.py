"""add user role and active

Revision ID: 0d056e915fef
Revises: product_line_catalog_020
Create Date: 2026-04-15 15:47:49.276182

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision: str = '0d056e915fef'
down_revision: Union[str, Sequence[str], None] = 'product_line_catalog_020'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "role",
            sa.String(length=48),
            nullable=False,
            server_default="ADMIN",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.create_index("ix_users_role", "users", ["role"], unique=False)
    op.create_index("ix_users_active", "users", ["active"], unique=False)
    op.execute("UPDATE users SET role = 'ADMIN' WHERE role IS NULL")
    op.execute("UPDATE users SET active = true WHERE active IS NULL")


def downgrade() -> None:
    op.drop_index("ix_users_active", table_name="users")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_column("users", "active")
    op.drop_column("users", "role")
