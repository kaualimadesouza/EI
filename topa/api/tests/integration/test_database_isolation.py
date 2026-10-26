from sqlalchemy import inspect, text

from topa_api.adapters.db.session import get_engine


def test_the_app_engine_points_at_the_test_database() -> None:
    with get_engine().connect() as connection:
        assert connection.scalar(text("SELECT current_database()")) == "topa_test"


def test_alembic_migrated_the_test_database() -> None:
    with get_engine().connect() as connection:
        assert inspect(connection).has_table("alembic_version")
