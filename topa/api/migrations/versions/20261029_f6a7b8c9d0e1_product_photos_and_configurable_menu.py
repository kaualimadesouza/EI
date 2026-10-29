"""product photos and configurable menu

Revision ID: f6a7b8c9d0e1
Revises: c5b1e84a20f9
Create Date: 2026-10-29 16:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: str | None = "c5b1e84a20f9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("products", sa.Column("photo_url", sa.Text(), nullable=True))
    op.drop_constraint(op.f("ck_products_category"), "products", type_="check")


def downgrade() -> None:
    op.create_check_constraint(
        op.f("ck_products_category"),
        "products",
        "category IN ('combos', 'lanches', 'salgados', 'bebidas', 'doces')",
    )
    op.drop_column("products", "photo_url")
