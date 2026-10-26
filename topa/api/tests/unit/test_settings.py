import pytest

from topa_api.settings import Settings

COMPOSE_DATABASE_URL = "postgresql+psycopg://topa:topa@db:5432/topa"


def test_database_url_follows_the_topa_prefixed_variable(monkeypatch: pytest.MonkeyPatch) -> None:
    """The compose file and CI point the app at their Postgres through this name."""
    monkeypatch.setenv("TOPA_DATABASE_URL", COMPOSE_DATABASE_URL)

    assert Settings().database_url == COMPOSE_DATABASE_URL
