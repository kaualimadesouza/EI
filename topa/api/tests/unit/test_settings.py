from pathlib import Path

import pytest

from topa_api.settings import Settings

COMPOSE_DATABASE_URL = "postgresql+psycopg://topa:topa@db:5432/topa"


@pytest.fixture(autouse=True)
def no_dotenv(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Settings reads .env from the working directory; a developer's own must not leak in."""
    monkeypatch.chdir(tmp_path)


def test_database_url_defaults_to_the_compose_postgres_on_the_host(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("TOPA_DATABASE_URL", raising=False)

    assert Settings().database_url == "postgresql+psycopg://topa:topa@localhost:5435/topa"


def test_database_url_follows_the_topa_prefixed_variable(monkeypatch: pytest.MonkeyPatch) -> None:
    """The compose file points the container at its Postgres through this name."""
    monkeypatch.setenv("TOPA_DATABASE_URL", COMPOSE_DATABASE_URL)

    assert Settings().database_url == COMPOSE_DATABASE_URL
