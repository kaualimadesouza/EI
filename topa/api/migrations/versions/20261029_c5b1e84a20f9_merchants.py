"""merchants table and default merchant seed

Revision ID: c5b1e84a20f9
Revises: a4c8e190b7d2
Create Date: 2026-10-29 14:00:00.000000

"""

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision: str = "c5b1e84a20f9"
down_revision: str | None = "a4c8e190b7d2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_MERCHANT_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")
DEFAULT_MERCHANT_EMAIL = "admin@bemtevi.topa.com"
DEFAULT_MERCHANT_PASSWORD_HASH = (
    "scrypt$16384$8$1$RbOmIS5mmaWyErZyGdJ2rA==$b5uT3hSeq9/rFu3jAvz5XDYuYiuV6wstDeQJ2udzTd4="
)
DEFAULT_STORE_SLUG = "lanchonete-bem-te-vi"


def upgrade() -> None:
    merchants = op.create_table(
        "merchants",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("store_slug", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["store_slug"],
            ["stores.slug"],
            name=op.f("fk_merchants_store_slug_stores"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_merchants")),
        sa.UniqueConstraint("email", name=op.f("uq_merchants_email")),
    )
    op.bulk_insert(
        merchants,
        [
            {
                "id": DEFAULT_MERCHANT_ID,
                "email": DEFAULT_MERCHANT_EMAIL,
                "password_hash": DEFAULT_MERCHANT_PASSWORD_HASH,
                "store_slug": DEFAULT_STORE_SLUG,
                "created_at": datetime(2026, 10, 29, 12, 0, tzinfo=UTC),
            }
        ],
    )


def downgrade() -> None:
    op.drop_table("merchants")
