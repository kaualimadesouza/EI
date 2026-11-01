from fastapi.testclient import TestClient


def test_create_totem_session_endpoint(client: TestClient) -> None:
    response = client.post(
        "/totem/sessions", json={"store_slug": "brasa-burgers", "duration_seconds": 1200}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["store_slug"] == "brasa-burgers"
    assert "token" in data
    assert "expires_at" in data
    assert "?loja=brasa-burgers&sessao=" in data["url"]

    # Now validate the token via GET /totem/sessions/validate
    val_res = client.get(
        "/totem/sessions/validate",
        params={"token": data["token"], "store_slug": "brasa-burgers"},
    )
    assert val_res.status_code == 200
    val_data = val_res.json()
    assert val_data["valid"] is True
    assert val_data["store_slug"] == "brasa-burgers"
    assert val_data["seconds_remaining"] > 0
    assert val_data["reason"] is None


def test_create_totem_session_invalid_store(client: TestClient) -> None:
    response = client.post("/totem/sessions", json={"store_slug": "loja-fantasma"})
    assert response.status_code == 404


def test_validate_totem_session_invalid_token(client: TestClient) -> None:
    val_res = client.get(
        "/totem/sessions/validate",
        params={"token": "invalid-token-123", "store_slug": "brasa-burgers"},
    )
    assert val_res.status_code == 200
    val_data = val_res.json()
    assert val_data["valid"] is False
    assert val_data["reason"] == "invalid_or_expired"


def test_stores_endpoint_returns_location_metadata(client: TestClient) -> None:
    response = client.get("/stores")
    assert response.status_code == 200
    stores = response.json()
    bemtevi = next(s for s in stores if s["slug"] == "lanchonete-bem-te-vi")
    assert bemtevi["latitude"] == -23.4823
    assert bemtevi["longitude"] == -46.5012
    assert bemtevi["address"] == "Praça Central - Bloco A"
    assert bemtevi["category"] == "Lanches Tradicionais"
