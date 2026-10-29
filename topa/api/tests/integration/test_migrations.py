import uuid
from datetime import UTC, date, datetime

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, insert, inspect, text

from topa_api.adapters.db.base import Base
from topa_api.adapters.db.models import OrderItemRow, OrderRow, ProductRow, StoreRow


def application_tables(engine: Engine) -> set[str]:
    return set(inspect(engine).get_table_names()) - {"alembic_version"}


def test_migrations_downgrade_to_base_and_upgrade_back_to_head(
    db_engine: Engine, alembic_config: Config
) -> None:
    """On topa_test, never TOPA_DATABASE_URL; it ends at head for the tests that follow."""
    assert application_tables(db_engine) == set(Base.metadata.tables)

    command.downgrade(alembic_config, "base")
    assert application_tables(db_engine) == set()

    command.upgrade(alembic_config, "head")
    assert application_tables(db_engine) == set(Base.metadata.tables)


def test_downgrade_from_populated_multi_store_database_succeeds(
    db_engine: Engine, alembic_config: Config
) -> None:
    """Extra stores with overlapping ids and daily numbers must not block downgrade."""
    default_order = uuid.uuid4()
    other_order = uuid.uuid4()
    now = datetime(2026, 10, 26, 15, 0, tzinfo=UTC)
    with db_engine.begin() as connection:
        connection.execute(insert(StoreRow).values(slug="cantina-central", name="Cantina Central"))
        connection.execute(
            insert(ProductRow).values(
                store_slug="cantina-central",
                id="coxinha",
                position=1,
                name="Coxinha da cantina",
                description="Frango.",
                category="salgados",
                price_cents=950,
                available=True,
            )
        )
        connection.execute(
            insert(OrderRow),
            [
                {
                    "id": default_order,
                    "store_slug": "lanchonete-bem-te-vi",
                    "business_date": date(2026, 10, 26),
                    "number": 1,
                    "status": "received",
                    "dine_in": True,
                    "payment_method": "pix",
                    "total_cents": 890,
                    "created_at": now,
                },
                {
                    "id": other_order,
                    "store_slug": "cantina-central",
                    "business_date": date(2026, 10, 26),
                    "number": 1,
                    "status": "received",
                    "dine_in": True,
                    "payment_method": "pix",
                    "total_cents": 950,
                    "created_at": now,
                },
            ],
        )
        connection.execute(
            insert(OrderItemRow),
            [
                {
                    "order_id": default_order,
                    "store_slug": "lanchonete-bem-te-vi",
                    "product_id": "coxinha",
                    "quantity": 1,
                    "unit_price_cents": 890,
                },
                {
                    "order_id": other_order,
                    "store_slug": "cantina-central",
                    "product_id": "coxinha",
                    "quantity": 1,
                    "unit_price_cents": 950,
                },
            ],
        )

    command.downgrade(alembic_config, "7db80bf0a5ff")
    with db_engine.connect() as connection:
        surviving = connection.scalars(text("SELECT id FROM orders")).all()
    assert surviving == [default_order]

    command.upgrade(alembic_config, "head")
    assert application_tables(db_engine) == set(Base.metadata.tables)


def test_migrations_at_head_match_the_models(db_engine: Engine, alembic_config: Config) -> None:
    """A model changed without its migration fails here, as `alembic check` would."""
    command.check(alembic_config)
