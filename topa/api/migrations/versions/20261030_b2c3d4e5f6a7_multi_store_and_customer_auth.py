"""multi store and customer auth

Revision ID: b2c3d4e5f6a7
Revises: f6a7b8c9d0e1
Create Date: 2026-10-30 13:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: str | None = "f6a7b8c9d0e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STORES_DATA = [
    {"slug": "brasa-burgers", "name": "Brasa Burgers"},
    {"slug": "bella-nonna", "name": "Cantina Bella Nonna"},
    {"slug": "acai-bowls", "name": "Açaí & Bowls Universitário"},
]

PRODUCTS_DATA = [
    # Brasa Burgers
    {
        "store_slug": "brasa-burgers",
        "id": "xbrasa",
        "position": 1,
        "name": "Brasa Burger Clássico",
        "description": "Blend 160g, queijo cheddar, alface, tomate e maionese defumada.",
        "category": "burgers",
        "price_cents": 2890,
        "available": True,
        "photo_url": None,
    },
    {
        "store_slug": "brasa-burgers",
        "id": "bacon-blast",
        "position": 2,
        "name": "Bacon Blast Duplo",
        "description": "Dois smash burgers, dobro de bacon crocante e queijo prato.",
        "category": "burgers",
        "price_cents": 3450,
        "available": True,
        "photo_url": None,
    },
    {
        "store_slug": "brasa-burgers",
        "id": "batata-rustica",
        "position": 3,
        "name": "Batata Rústica",
        "description": "Porção de batatas com alecrim e páprica defumada.",
        "category": "acompanhamentos",
        "price_cents": 1400,
        "available": True,
        "photo_url": None,
    },
    {
        "store_slug": "brasa-burgers",
        "id": "onion-rings",
        "position": 4,
        "name": "Anéis de Cebola",
        "description": "Cebolas empanadas crocantes acompanhadas de molho barbecue.",
        "category": "acompanhamentos",
        "price_cents": 1600,
        "available": True,
        "photo_url": None,
    },
    {
        "store_slug": "brasa-burgers",
        "id": "coca-cola",
        "position": 5,
        "name": "Coca-Cola Lata",
        "description": "Lata 350 ml bem gelada.",
        "category": "bebidas",
        "price_cents": 650,
        "available": True,
        "photo_url": None,
    },
    {
        "store_slug": "brasa-burgers",
        "id": "suco-laranja",
        "position": 6,
        "name": "Suco de Laranja",
        "description": "Suco natural feito na hora, copo 400 ml.",
        "category": "bebidas",
        "price_cents": 900,
        "available": True,
        "photo_url": None,
    },
    # Cantina Bella Nonna
    {
        "store_slug": "bella-nonna",
        "id": "lasanha-bolonhesa",
        "position": 1,
        "name": "Lasanha à Bolonhesa",
        "description": "Massa artesanal com molho bolonhesa encorpado e queijo gratinado.",
        "category": "massas",
        "price_cents": 3200,
        "available": True,
        "photo_url": None,
    },
    {
        "store_slug": "bella-nonna",
        "id": "penne-quatro-queijos",
        "position": 2,
        "name": "Penne Quatro Queijos",
        "description": "Penne ao molho cremoso de provolone, parmesão, gorgonzola e mussarela.",
        "category": "massas",
        "price_cents": 2950,
        "available": True,
        "photo_url": None,
    },
    {
        "store_slug": "bella-nonna",
        "id": "calzone-frango",
        "position": 3,
        "name": "Calzone de Frango",
        "description": "Frango desfiado temperado com catupiry envolto em massa assada.",
        "category": "calzones",
        "price_cents": 2200,
        "available": True,
        "photo_url": None,
    },
    {
        "store_slug": "bella-nonna",
        "id": "bruschetta",
        "position": 4,
        "name": "Bruschetta Italiana",
        "description": "Pão rústico tostado com azeite, tomates frescos, alho e manjericão.",
        "category": "entradas",
        "price_cents": 1500,
        "available": True,
        "photo_url": None,
    },
    {
        "store_slug": "bella-nonna",
        "id": "suco-uva-integral",
        "position": 5,
        "name": "Suco de Uva Integral",
        "description": "Garrafinha 300 ml 100% fruta.",
        "category": "bebidas",
        "price_cents": 850,
        "available": True,
        "photo_url": None,
    },
    {
        "store_slug": "bella-nonna",
        "id": "tiramisu",
        "position": 6,
        "name": "Tiramisù Clássico",
        "description": "Sobremesa italiana à base de queijo mascarpone, café e cacau.",
        "category": "sobremesas",
        "price_cents": 1600,
        "available": True,
        "photo_url": None,
    },
    # Açaí & Bowls Universitário
    {
        "store_slug": "acai-bowls",
        "id": "acai-tradicional-500",
        "position": 1,
        "name": "Açaí Tradicional 500ml",
        "description": "Tigela de açaí puro servida com banana fatiada e granola crocante.",
        "category": "acai",
        "price_cents": 2400,
        "available": True,
        "photo_url": None,
    },
    {
        "store_slug": "acai-bowls",
        "id": "acai-turbinado",
        "position": 2,
        "name": "Açaí Turbinado",
        "description": "Açaí 500ml com morango, leite condensado, paçoca e leite em pó.",
        "category": "acai",
        "price_cents": 2750,
        "available": True,
        "photo_url": None,
    },
    {
        "store_slug": "acai-bowls",
        "id": "bowl-pitaya",
        "position": 3,
        "name": "Bowl de Pitaya Rosa",
        "description": "Creme gelado de pitaya com kiwi, morango e sementes de chia.",
        "category": "bowls",
        "price_cents": 2600,
        "available": True,
        "photo_url": None,
    },
    {
        "store_slug": "acai-bowls",
        "id": "tapioca-frango",
        "position": 4,
        "name": "Tapioca de Frango",
        "description": "Massa leve recheada com frango desfiado e queijo minas.",
        "category": "salgados",
        "price_cents": 1800,
        "available": True,
        "photo_url": None,
    },
    {
        "store_slug": "acai-bowls",
        "id": "smoothie-frutas-vermelhas",
        "position": 5,
        "name": "Smoothie Frutas Vermelhas",
        "description": "Batido cremoso de iogurte natural com amora, framboesa e mirtilo.",
        "category": "bebidas",
        "price_cents": 1400,
        "available": True,
        "photo_url": None,
    },
    {
        "store_slug": "acai-bowls",
        "id": "salada-frutas",
        "position": 6,
        "name": "Salada de Frutas com Mel",
        "description": "Mix de frutas da estação cortadas na hora acompanhadas de mel.",
        "category": "sobremesas",
        "price_cents": 1200,
        "available": True,
        "photo_url": None,
    },
]


def upgrade() -> None:
    op.create_table(
        "customers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_customers")),
        sa.UniqueConstraint("email", name=op.f("uq_customers_email")),
    )
    op.add_column(
        "orders",
        sa.Column(
            "customer_id",
            sa.Uuid(),
            sa.ForeignKey("customers.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(op.f("ix_orders_customer_id"), "orders", ["customer_id"], unique=False)

    stores_table = sa.table(
        "stores",
        sa.column("slug", sa.Text),
        sa.column("name", sa.Text),
    )
    op.bulk_insert(stores_table, STORES_DATA)

    products_table = sa.table(
        "products",
        sa.column("store_slug", sa.Text),
        sa.column("id", sa.Text),
        sa.column("position", sa.Integer),
        sa.column("name", sa.Text),
        sa.column("description", sa.Text),
        sa.column("category", sa.Text),
        sa.column("price_cents", sa.Integer),
        sa.column("available", sa.Boolean),
        sa.column("photo_url", sa.Text),
    )
    op.bulk_insert(products_table, PRODUCTS_DATA)


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM orders WHERE store_slug IN ('brasa-burgers', 'bella-nonna', 'acai-bowls')"
        )
    )
    op.execute(
        sa.text(
            "DELETE FROM products WHERE store_slug IN ('brasa-burgers', 'bella-nonna', 'acai-bowls')"
        )
    )
    op.execute(
        sa.text("DELETE FROM stores WHERE slug IN ('brasa-burgers', 'bella-nonna', 'acai-bowls')")
    )
    op.drop_index(op.f("ix_orders_customer_id"), table_name="orders")
    op.drop_column("orders", "customer_id")
    op.drop_table("customers")
