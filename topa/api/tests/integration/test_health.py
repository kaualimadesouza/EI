import socket
import threading
import time
from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from topa_api.adapters.db.session import DatabaseReadinessProbe, create_database_engine
from topa_api.presentation.fastapi.dependencies import get_readiness_probe

# the silent server hangs up after this, so losing connect_timeout fails the
# test below instead of hanging the suite for as long as TCP keepalive allows
HANG_UP_AFTER_SECONDS = 10


@pytest.fixture
def silent_database_url() -> Iterator[str]:
    """Completes the TCP handshake and never speaks Postgres, like a blackholed host."""
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen()
        hang_up = threading.Timer(HANG_UP_AFTER_SECONDS, listener.close)
        hang_up.start()
        yield f"postgresql+psycopg://topa:topa@127.0.0.1:{listener.getsockname()[1]}/topa"
        hang_up.cancel()


class ProbeThatMustNotRun:
    def database_is_up(self) -> bool:
        raise AssertionError("liveness consulted the database")


def test_health_answers_without_consulting_the_database(app: FastAPI) -> None:
    """Liveness must not touch the database, or a probe cannot tell a dead
    process from one that is up but cannot reach Postgres."""
    app.dependency_overrides[get_readiness_probe] = ProbeThatMustNotRun

    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_reports_the_database_up(client: TestClient) -> None:
    response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"database": "up"}


def test_ready_answers_503_in_seconds_when_the_database_never_answers(
    app: FastAPI, silent_database_url: str, caplog: pytest.LogCaptureFixture
) -> None:
    engine = create_database_engine(silent_database_url)
    app.dependency_overrides[get_readiness_probe] = lambda: DatabaseReadinessProbe(engine)

    started = time.monotonic()
    response = TestClient(app).get("/health/ready")
    elapsed = time.monotonic() - started

    assert response.status_code == 503
    assert response.json() == {"database": "down"}
    assert "database is not answering" in caplog.text
    assert elapsed < HANG_UP_AFTER_SECONDS
