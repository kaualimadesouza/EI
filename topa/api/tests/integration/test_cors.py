import pytest
from fastapi.testclient import TestClient

from topa_api.entrypoints.rest_application import create_app

SITE = "https://topa-totem.vercel.app"
ANDROID_APP = "http://tauri.localhost"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("TOPA_CORS_ORIGINS", f'["{SITE}", "{ANDROID_APP}"]')
    return TestClient(create_app())


@pytest.mark.parametrize("origin", [SITE, ANDROID_APP])
def test_a_listed_origin_may_place_an_order(client: TestClient, origin: str) -> None:
    """The browser asks first: a JSON POST from another origin is preflighted."""
    response = client.options(
        "/orders",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert "POST" in response.headers["access-control-allow-methods"]
    assert "content-type" in response.headers["access-control-allow-headers"].lower()


def test_a_listed_origin_reads_the_response(client: TestClient) -> None:
    response = client.get("/health", headers={"Origin": SITE})

    assert response.headers["access-control-allow-origin"] == SITE


def test_any_other_origin_gets_no_permission(client: TestClient) -> None:
    response = client.get("/health", headers={"Origin": "https://evil.example"})

    assert "access-control-allow-origin" not in response.headers
