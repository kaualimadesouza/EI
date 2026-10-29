"""stores and store menus

Revision ID: a4c8e190b7d2
Revises: 7db80bf0a5ff
Create Date: 2026-10-29 11:25:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a4c8e190b7d2"
down_revision: str | None = "7db80bf0a5ff"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_STORE = ("lanchonete-bem-te-vi", "Lanchonete Bem-te-vi")


def upgrade() -> None:
    stores = op.create_table(
        "stores",
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("slug", name=op.f("pk_stores")),
    )
    op.bulk_insert(stores, [{"slug": DEFAULT_STORE[0], "name": DEFAULT_STORE[1]}])

    op.drop_constraint(
        op.f("fk_order_items_product_id_products"), "order_items", type_="foreignkey"
    )
    op.drop_constraint(op.f("fk_order_items_order_id_orders"), "order_items", type_="foreignkey")
    op.drop_constraint(op.f("uq_products_position"), "products", type_="unique")
    op.drop_constraint(op.f("pk_products"), "products", type_="primary")

    op.add_column(
        "products",
        sa.Column("store_slug", sa.Text(), server_default=DEFAULT_STORE[0], nullable=False),
    )
    op.create_primary_key(op.f("pk_products"), "products", ["store_slug", "id"])
    op.create_foreign_key(
        op.f("fk_products_store_slug_stores"), "products", "stores", ["store_slug"], ["slug"]
    )
    op.create_unique_constraint(
        op.f("uq_products_store_slug_position"), "products", ["store_slug", "position"]
    )

    op.add_column(
        "orders",
        sa.Column("store_slug", sa.Text(), server_default=DEFAULT_STORE[0], nullable=False),
    )
    op.drop_constraint(op.f("uq_orders_business_date_number"), "orders", type_="unique")
    op.create_foreign_key(
        op.f("fk_orders_store_slug_stores"), "orders", "stores", ["store_slug"], ["slug"]
    )
    op.create_unique_constraint(
        op.f("uq_orders_store_slug_business_date_number"),
        "orders",
        ["store_slug", "business_date", "number"],
    )
    op.create_unique_constraint(op.f("uq_orders_id_store_slug"), "orders", ["id", "store_slug"])

    op.add_column(
        "order_items",
        sa.Column("store_slug", sa.Text(), server_default=DEFAULT_STORE[0], nullable=False),
    )
    op.create_foreign_key(
        op.f("fk_order_items_order_id_orders"),
        "order_items",
        "orders",
        ["order_id", "store_slug"],
        ["id", "store_slug"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        op.f("fk_order_items_store_slug_products"),
        "order_items",
        "products",
        ["store_slug", "product_id"],
        ["store_slug", "id"],
    )


def downgrade() -> None:
    # the previous schema holds one store only: drop extra stores' rows before restoring single-store keys
    op.execute(f"DELETE FROM orders WHERE store_slug <> '{DEFAULT_STORE[0]}'")
    op.execute(f"DELETE FROM products WHERE store_slug <> '{DEFAULT_STORE[0]}'")

    op.drop_constraint(
        op.f("fk_order_items_store_slug_products"), "order_items", type_="foreignkey"
    )
    op.drop_constraint(op.f("fk_order_items_order_id_orders"), "order_items", type_="foreignkey")
    op.drop_column("order_items", "store_slug")
    op.create_foreign_key(
        op.f("fk_order_items_order_id_orders"),
        "order_items",
        "orders",
        ["order_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint(op.f("uq_orders_id_store_slug"), "orders", type_="unique")
    op.drop_constraint(op.f("uq_orders_store_slug_business_date_number"), "orders", type_="unique")
    op.drop_constraint(op.f("fk_orders_store_slug_stores"), "orders", type_="foreignkey")
    op.drop_column("orders", "store_slug")
    op.create_unique_constraint(
        op.f("uq_orders_business_date_number"), "orders", ["business_date", "number"]
    )

    op.drop_constraint(op.f("uq_products_store_slug_position"), "products", type_="unique")
    op.drop_constraint(op.f("fk_products_store_slug_stores"), "products", type_="foreignkey")
    op.drop_constraint(op.f("pk_products"), "products", type_="primary")
    op.drop_column("products", "store_slug")
    op.create_primary_key(op.f("pk_products"), "products", ["id"])
    op.create_unique_constraint(op.f("uq_products_position"), "products", ["position"])
    op.create_foreign_key(
        op.f("fk_order_items_product_id_products"),
        "order_items",
        "products",
        ["product_id"],
        ["id"],
    )

    op.drop_table("stores")
