"""merge heads: documents + user role

Revision ID: d469ef7f39bf
Revises: 0d056e915fef, documents_metadata_021
Create Date: 2026-04-15 16:47:05.433871

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision: str = 'd469ef7f39bf'
down_revision: Union[str, Sequence[str], None] = ('0d056e915fef', 'documents_metadata_021')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
