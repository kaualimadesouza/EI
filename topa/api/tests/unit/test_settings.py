import pytest

from topa_api.settings import Settings

COMPOSE_DATABASE_URL = "postgresql+psycopg://topa:topa@db:5432/topa"


def test_database_url_follows_the_topa_prefixed_variable(monkeypatch: pytest.MonkeyPatch) -> None:
    """The compose file and CI point the app at their Postgres through this name."""
    monkeypatch.setenv("TOPA_DATABASE_URL", COMPOSE_DATABASE_URL)

    assert Settings().database_url == COMPOSE_DATABASE_URL


NEON_HOST = "ep-example-pooler.neon.tech/topa?sslmode=require"
NEON_STYLE_URL = f"postgresql://topa:secret@{NEON_HOST}"  # pragma: allowlist secret
PSYCOPG_URL = f"postgresql+psycopg://topa:secret@{NEON_HOST}"  # pragma: allowlist secret


@pytest.mark.parametrize("scheme", ["postgresql://", "postgres://"])
def test_a_bare_postgres_url_runs_on_psycopg3(scheme: str) -> None:
    """Neon hands out bare URLs, which SQLAlchemy maps to psycopg2; only psycopg3 is installed."""
    bare = NEON_STYLE_URL.replace("postgresql://", scheme)

    assert Settings(database_url=bare).database_url == PSYCOPG_URL


def test_a_url_that_names_its_driver_is_kept() -> None:
    assert Settings(database_url=COMPOSE_DATABASE_URL).database_url == COMPOSE_DATABASE_URL


def test_no_origin_may_call_the_api_from_a_browser_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("TOPA_CORS_ORIGINS", raising=False)

    assert Settings().cors_origins == []


def test_cors_origins_come_as_a_json_list(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "TOPA_CORS_ORIGINS", '["https://topa-totem.vercel.app", "tauri://localhost"]'
    )

    assert Settings().cors_origins == ["https://topa-totem.vercel.app", "tauri://localhost"]


def test_no_origin_pattern_is_allowed_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("TOPA_CORS_ORIGIN_REGEX", raising=False)

    assert Settings().cors_origin_regex is None


def test_the_origin_pattern_follows_the_topa_prefixed_variable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TOPA_CORS_ORIGIN_REGEX", "^https://topa-totem[.]vercel[.]app$")

    assert Settings().cors_origin_regex == "^https://topa-totem[.]vercel[.]app$"
