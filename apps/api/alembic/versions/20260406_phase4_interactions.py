"""interactions and opportunity next_action_due_at

Revision ID: phase4_005
Revises: phase3_004
Create Date: 2026-04-06

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "phase4_005"
down_revision: Union[str, Sequence[str], None] = "phase3_004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "opportunities",
        sa.Column("next_action_due_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_opportunities_next_action_due_at",
        "opportunities",
        ["next_action_due_at"],
        unique=False,
    )
    op.create_table(
        "interactions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("opportunity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("interaction_type", sa.String(length=48), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["opportunity_id"], ["opportunities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_interactions_organization_id", "interactions", ["organization_id"])
    op.create_index("ix_interactions_client_id", "interactions", ["client_id"])
    op.create_index("ix_interactions_opportunity_id", "interactions", ["opportunity_id"])
    op.create_index("ix_interactions_created_by_id", "interactions", ["created_by_id"])
    op.create_index("ix_interactions_occurred_at", "interactions", ["occurred_at"])


def downgrade() -> None:
    op.drop_index("ix_interactions_occurred_at", table_name="interactions")
    op.drop_index("ix_interactions_created_by_id", table_name="interactions")
    op.drop_index("ix_interactions_opportunity_id", table_name="interactions")
    op.drop_index("ix_interactions_client_id", table_name="interactions")
    op.drop_index("ix_interactions_organization_id", table_name="interactions")
    op.drop_table("interactions")
    op.drop_index("ix_opportunities_next_action_due_at", table_name="opportunities")
    op.drop_column("opportunities", "next_action_due_at")
