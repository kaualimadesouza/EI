from fastapi.testclient import TestClient

ORDER_PAYLOAD = {
    "store_slug": "lanchonete-bem-te-vi",
    "items": [{"product_id": "cafe", "quantity": 1}],
    "dine_in": True,
    "payment_method": "pix",
}


def test_post_orders_rate_limiting_by_client_ip(client: TestClient) -> None:
    ip = "203.0.113.42"
    headers = {"X-Forwarded-For": ip}

    # First 10 requests succeed
    for _ in range(10):
        response = client.post("/orders", json=ORDER_PAYLOAD, headers=headers)
        assert response.status_code == 201

    # 11th request triggers rate limit
    blocked = client.post("/orders", json=ORDER_PAYLOAD, headers=headers)
    assert blocked.status_code == 429
    assert blocked.json()["detail"] == "Muitos pedidos enviados. Aguarde um momento."
    assert "retry-after" in blocked.headers
    retry_after = int(blocked.headers["retry-after"])
    assert retry_after > 0

    # A different client IP has its own budget and is not blocked
    other_ip_response = client.post(
        "/orders", json=ORDER_PAYLOAD, headers={"X-Forwarded-For": "198.51.100.99"}
    )
    assert other_ip_response.status_code == 201


def test_client_ip_fallback_when_no_forwarded_or_client() -> None:
    from fastapi import Request

    from topa_api.presentation.fastapi.orders import _client_ip

    req = Request({"type": "http", "headers": []})
    assert _client_ip(req) == "127.0.0.1"
