from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, NullPool, create_engine, make_url, text

from topa_api.adapters.db.base import Base
from topa_api.adapters.db.session import get_engine
from topa_api.entrypoints.rest_application import create_app
from topa_api.settings import Settings

ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"
TEST_DATABASE = "topa_test"


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
def clean_database(db_engine: Engine) -> Iterator[None]:
    yield
    tables = ", ".join(table.name for table in Base.metadata.sorted_tables)
    if tables:
        with db_engine.begin() as connection:
            connection.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


@pytest.fixture
def app(db_engine: Engine) -> FastAPI:
    return create_app()


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
