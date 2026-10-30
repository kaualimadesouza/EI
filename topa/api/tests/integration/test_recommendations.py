from fastapi.testclient import TestClient


def test_recommendations_endpoint_returns_suggestions(client: TestClient) -> None:
    response = client.post(
        "/stores/brasa-burgers/recommendations",
        json={"cart_product_ids": [], "client_id": "treatment-user-999", "limit": 3},
    )
    assert response.status_code == 200
    body = response.json()
    assert "items" in body
    assert "strategy_used" in body
    assert "ab_group" in body


def test_recommendations_endpoint_complements_cart(client: TestClient) -> None:
    response = client.post(
        "/stores/lanchonete-bem-te-vi/recommendations",
        json={"cart_product_ids": ["misto"], "client_id": None, "limit": 2},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["strategy_used"] == "association_rules"
    assert len(body["items"]) <= 2
    for item in body["items"]:
        assert item["product_id"] != "misto"


def test_recommendations_unknown_store_returns_404(client: TestClient) -> None:
    response = client.post(
        "/stores/loja-inexistente/recommendations",
        json={"cart_product_ids": []},
    )
    assert response.status_code == 404
    assert response.json() == {"detail": "Loja não encontrada."}
