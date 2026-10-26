from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from topa_api.adapters.db.session import get_engine
from topa_api.entrypoints.rest_application import create_app

# nothing listens on port 1, so the connection is refused at once instead of hanging
UNREACHABLE_DATABASE_URL = "postgresql+psycopg://topa:topa@127.0.0.1:1/topa"


@pytest.fixture
def offline_client() -> Iterator[TestClient]:
    engine = create_engine(UNREACHABLE_DATABASE_URL, connect_args={"connect_timeout": 2})
    app = create_app()
    app.dependency_overrides[get_engine] = lambda: engine
    with TestClient(app) as test_client:
        yield test_client
    engine.dispose()


def test_health_reports_the_process_alive() -> None:
    response = TestClient(create_app()).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_answers_with_the_database_down(offline_client: TestClient) -> None:
    """Liveness must not touch the database, or a probe cannot tell a dead
    process from one that is up but cannot reach Postgres."""
    response = offline_client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_reports_the_database_up(client: TestClient) -> None:
    response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "up"}


def test_ready_answers_503_when_the_database_is_unreachable(
    offline_client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    response = offline_client.get("/health/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "database": "down"}
    assert "database is not answering" in caplog.text
