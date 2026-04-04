"""Phase 0 initial revision (empty schema).

Revision ID: phase0_001
Revises:
Create Date: 2026-04-04

"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "phase0_001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
