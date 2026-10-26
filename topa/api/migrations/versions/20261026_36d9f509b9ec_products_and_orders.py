"""products and orders

Revision ID: 36d9f509b9ec
Revises:
Create Date: 2026-10-26 15:52:16.505501

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "36d9f509b9ec"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# the demo menu, in the order the kiosk shows it: (id, category, name, description, price_cents)
MENU = [
    ("combo-cafe", "combos", "Café + pão de queijo", "Café coado e três pães de queijo.", 1290),
    ("combo-misto", "combos", "Misto + suco", "Misto quente com suco de laranja de 300 ml.", 2290),
    ("misto", "lanches", "Misto quente", "Pão de forma, presunto e queijo na chapa.", 1490),
    ("xsalada", "lanches", "X-salada", "Hambúrguer, queijo, alface e tomate.", 2290),
    ("bauru", "lanches", "Bauru", "Rosbife, queijo, tomate e picles no pão francês.", 1890),
    ("americano", "lanches", "Americano", "Presunto, queijo, ovo, alface e tomate.", 1990),
    ("paoqueijo", "salgados", "Pão de queijo", "Porção com três unidades.", 750),
    ("coxinha", "salgados", "Coxinha", "Frango com catupiry.", 890),
    ("esfiha", "salgados", "Esfiha de carne", "Massa aberta com carne temperada.", 790),
    ("enroladinho", "salgados", "Enroladinho", "Salsicha em massa assada.", 690),
    ("cafe", "bebidas", "Café coado", "Xícara de 150 ml.", 550),
    ("suco", "bebidas", "Suco de laranja", "Natural, 300 ml.", 990),
    ("refri", "bebidas", "Refrigerante", "Copo de 350 ml com gelo.", 690),
    ("agua", "bebidas", "Água sem gás", "500 ml.", 400),
    ("bolo", "doces", "Bolo de cenoura", "Fatia com cobertura de chocolate.", 850),
    ("pudim", "doces", "Pudim", "Fatia de pudim de leite.", 990),
    ("brigadeiro", "doces", "Brigadeiro", "Unidade.", 450),
    ("brownie", "doces", "Brownie", "Com nozes.", 890),
]


def upgrade() -> None:
    products = op.create_table(
        "products",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("price_cents", sa.Integer(), nullable=False),
        sa.Column("available", sa.Boolean(), nullable=False),
        sa.CheckConstraint(
            "category IN ('combos', 'lanches', 'salgados', 'bebidas', 'doces')",
            name=op.f("ck_products_category"),
        ),
        sa.CheckConstraint("price_cents >= 0", name=op.f("ck_products_price_cents")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_products")),
        sa.UniqueConstraint("position", name=op.f("uq_products_position")),
    )
    op.create_table(
        "orders",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("business_date", sa.Date(), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("dine_in", sa.Boolean(), nullable=False),
        sa.Column("payment_method", sa.Text(), nullable=False),
        sa.Column("total_cents", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "payment_method IN ('card', 'pix')", name=op.f("ck_orders_payment_method")
        ),
        sa.CheckConstraint("status IN ('received')", name=op.f("ck_orders_status")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_orders")),
        sa.UniqueConstraint("business_date", "number", name=op.f("uq_orders_business_date_number")),
    )
    op.create_table(
        "order_items",
        sa.Column("order_id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price_cents", sa.Integer(), nullable=False),
        sa.CheckConstraint("quantity >= 1", name=op.f("ck_order_items_quantity")),
        sa.CheckConstraint("unit_price_cents >= 0", name=op.f("ck_order_items_unit_price_cents")),
        sa.ForeignKeyConstraint(
            ["order_id"],
            ["orders.id"],
            name=op.f("fk_order_items_order_id_orders"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"], ["products.id"], name=op.f("fk_order_items_product_id_products")
        ),
        sa.PrimaryKeyConstraint("order_id", "product_id", name=op.f("pk_order_items")),
    )
    op.bulk_insert(
        products,
        [
            {
                "id": product_id,
                "position": position,
                "name": name,
                "description": description,
                "category": category,
                "price_cents": price_cents,
                "available": True,
            }
            for position, (product_id, category, name, description, price_cents) in enumerate(
                MENU, start=1
            )
        ],
    )


def downgrade() -> None:
    op.drop_table("order_items")
    op.drop_table("orders")
    op.drop_table("products")
