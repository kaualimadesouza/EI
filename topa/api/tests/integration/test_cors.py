import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from topa_api.entrypoints.rest_application import create_app

ANDROID_APP = "http://tauri.localhost"
SITE = "https://topa-totem.vercel.app"
# the project's Vercel URLs: the PROD and DEV aliases, one deployment and one branch preview
VERCEL_URLS = [
    SITE,
    "https://topa-totem-dev.vercel.app",
    "https://topa-totem-a1b2c3d4e-kaualimadesouzas-projects.vercel.app",
    "https://topa-totem-git-feat-web-uses-prod-api-kaualimadesouzas-projects.vercel.app",
]
MAIN_TF = Path(__file__).parents[2] / "infrastructure" / "main.tf"


def deployed_origin_regex() -> str:
    """Read from main.tf, so these tests guard the pattern the Lambda actually gets."""
    found = re.search(r'cors_origin_regex\s*=\s*"([^"]+)"', MAIN_TF.read_text())
    assert found is not None
    return found.group(1)


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("TOPA_CORS_ORIGINS", f'["{ANDROID_APP}"]')
    monkeypatch.setenv("TOPA_CORS_ORIGIN_REGEX", deployed_origin_regex())
    return TestClient(create_app())


@pytest.mark.parametrize("origin", [*VERCEL_URLS, ANDROID_APP])
def test_an_allowed_origin_may_place_an_order(client: TestClient, origin: str) -> None:
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


@pytest.mark.parametrize("origin", [SITE, ANDROID_APP])
def test_an_allowed_origin_reads_the_response(client: TestClient, origin: str) -> None:
    response = client.get("/health", headers={"Origin": origin})

    assert response.headers["access-control-allow-origin"] == origin


@pytest.mark.parametrize(
    "origin",
    [
        "https://evil.example",
        "http://topa-totem.vercel.app",
        "https://topa-totem.vercel.app.evil.example",
        "https://evil-topa-totem.vercel.app",
        "https://topa-totemx.vercel.app",
        "https://topa-totem-staging.vercel.app",
    ],
)
def test_any_other_origin_gets_no_permission(client: TestClient, origin: str) -> None:
    response = client.get("/health", headers={"Origin": origin})

    assert "access-control-allow-origin" not in response.headers
