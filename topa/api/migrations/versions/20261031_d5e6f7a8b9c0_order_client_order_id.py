"""order client order id for offline sync idempotency

Revision ID: d5e6f7a8b9c0
Revises: b2c3d4e5f6a7
Create Date: 2026-10-31 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d5e6f7a8b9c0"
down_revision: str | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("client_order_id", sa.Uuid(), nullable=True))
    op.create_index("ix_orders_client_order_id", "orders", ["client_order_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_orders_client_order_id", table_name="orders")
    op.drop_column("orders", "client_order_id")
