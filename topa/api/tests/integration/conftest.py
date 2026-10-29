from collections.abc import Callable, Iterator
from datetime import UTC, datetime
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, NullPool, create_engine, delete, make_url, text, update

from tests.fakes import FixedClock
from topa_api.adapters.db.models import OrderRow, ProductRow, StoreRow
from topa_api.adapters.db.session import get_engine
from topa_api.domain.catalog import DEFAULT_STORE_SLUG
from topa_api.entrypoints.rest_application import create_app
from topa_api.presentation.fastapi.dependencies import get_clock
from topa_api.settings import Settings

ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"
TEST_DATABASE = "topa_test"

# 15h UTC is noon in São Paulo, far from either edge of the business day
NOON_IN_SAO_PAULO = datetime(2026, 10, 26, 15, 0, tzinfo=UTC)


@pytest.fixture(scope="session")
def alembic_config() -> Config:
    return Config(str(ALEMBIC_INI))


@pytest.fixture(scope="session")
def db_engine(alembic_config: Config) -> Iterator[Engine]:
    """A throwaway database next to the configured one: every test truncates what it
    wrote, so pointed at the dev database the suite would wipe it."""
    server_url = make_url(Settings().database_url)
    admin = create_engine(
        server_url.set(database="postgres"), isolation_level="AUTOCOMMIT", poolclass=NullPool
    )
    with admin.connect() as connection:
        connection.execute(text(f"DROP DATABASE IF EXISTS {TEST_DATABASE}"))
        connection.execute(text(f"CREATE DATABASE {TEST_DATABASE}"))

    test_url = server_url.set(database=TEST_DATABASE).render_as_string(hide_password=False)
    with pytest.MonkeyPatch.context() as env:
        # Alembic's env.py and get_engine() both read Settings, so one variable moves both;
        # importing create_app above already cached an engine on the configured URL
        env.setenv("TOPA_DATABASE_URL", test_url)
        get_engine.cache_clear()
        command.upgrade(alembic_config, "head")
        yield get_engine()
        get_engine().dispose()
    get_engine.cache_clear()

    with admin.connect() as connection:
        connection.execute(text(f"DROP DATABASE {TEST_DATABASE}"))


@pytest.fixture(autouse=True)
def reset_database(db_engine: Engine) -> Iterator[None]:
    """The seeded store and menu stay, all back on sale; extra stores and orders go."""
    yield
    with db_engine.begin() as connection:
        connection.execute(delete(OrderRow))
        connection.execute(delete(ProductRow).where(ProductRow.store_slug != DEFAULT_STORE_SLUG))
        connection.execute(delete(StoreRow).where(StoreRow.slug != DEFAULT_STORE_SLUG))
        connection.execute(update(ProductRow).values(available=True))


@pytest.fixture
def clock() -> FixedClock:
    return FixedClock(NOON_IN_SAO_PAULO)


@pytest.fixture
def app(db_engine: Engine, clock: FixedClock) -> FastAPI:
    application = create_app()
    application.dependency_overrides[get_clock] = lambda: clock
    return application


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def sell_out(db_engine: Engine) -> Callable[[str], None]:
    """Marks a seeded product unavailable for one test; reset_database puts it back."""

    def mark(product_id: str) -> None:
        with db_engine.begin() as connection:
            connection.execute(
                update(ProductRow).where(ProductRow.id == product_id).values(available=False)
            )

    return mark
