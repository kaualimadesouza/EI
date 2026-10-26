"""order status lifecycle

Revision ID: 7db80bf0a5ff
Revises: 36d9f509b9ec
Create Date: 2026-10-26 16:06:36.195582

"""

from collections.abc import Sequence

from alembic import op

revision: str = "7db80bf0a5ff"
down_revision: str | None = "36d9f509b9ec"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(op.f("ck_orders_status"), "orders", type_="check")
    op.create_check_constraint(
        op.f("ck_orders_status"),
        "orders",
        "status IN ('received', 'preparing', 'ready', 'delivered')",
    )


def downgrade() -> None:
    # the previous schema knows only 'received': fold the later statuses back into it,
    # or a database that already moved an order could never be downgraded
    op.execute("UPDATE orders SET status = 'received' WHERE status <> 'received'")
    op.drop_constraint(op.f("ck_orders_status"), "orders", type_="check")
    op.create_check_constraint(op.f("ck_orders_status"), "orders", "status IN ('received')")
