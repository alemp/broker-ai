"""Normalize campaigns.kind to CampaignKind enum strings."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260416_campaign_kind"
down_revision = "20260415_party"
branch_labels = None
depends_on = None

_VALID_KINDS = (
    "BIRTHDAY",
    "RENEWAL_REMINDER",
    "CROSS_SELL",
    "SEASONAL",
    "NEWSLETTER",
    "REENGAGEMENT",
    "CUSTOM",
)


def upgrade() -> None:
    op.execute(
        sa.text("UPDATE campaigns SET kind = 'BIRTHDAY' WHERE lower(btrim(kind)) = 'birthday'"),
    )
    op.execute(
        sa.text(
            "UPDATE campaigns SET kind = 'CUSTOM' WHERE lower(btrim(kind)) IN ('custom', 'other')",
        ),
    )
    op.execute(
        sa.text(
            "UPDATE campaigns SET kind = 'SEASONAL' WHERE kind IN ("
            "'winter', 'summer_unique_kind', 'WINTER', 'SUMMER', 'summer', 'Summer')",
        ),
    )
    in_list = ", ".join(f"'{k}'" for k in _VALID_KINDS)
    op.execute(
        sa.text(f"UPDATE campaigns SET kind = 'CUSTOM' WHERE kind NOT IN ({in_list})"),
    )


def downgrade() -> None:
    """Legacy free-text kinds cannot be restored."""
