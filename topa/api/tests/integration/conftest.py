from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from topa_api.adapters.db.session import get_engine
from topa_api.entrypoints.rest_application import create_app

ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"


@pytest.fixture(scope="session")
def db_engine() -> Engine:
    command.upgrade(Config(str(ALEMBIC_INI)), "head")
    return get_engine()


@pytest.fixture
def client(db_engine: Engine) -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client
