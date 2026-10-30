from fastapi.testclient import TestClient


def _create_customer_token(client: TestClient, email: str, name: str) -> str:
    res = client.post(
        "/auth/customer/register",
        json={"name": name, "email": email, "password": "senhadecliente123"},
    )
    assert res.status_code == 200
    return str(res.json()["access_token"])


def test_order_placement_with_and_without_customer_token(client: TestClient) -> None:
    token_a = _create_customer_token(client, "alice@exemplo.com", "Alice")
    token_b = _create_customer_token(client, "bob@exemplo.com", "Bob")

    # Order 1: Anonymous order (e.g. at the physical kiosk or QR code)
    anon_res = client.post(
        "/orders",
        json={
            "store_slug": "brasa-burgers",
            "items": [{"product_id": "xbrasa", "quantity": 1}],
            "dine_in": True,
            "payment_method": "card",
        },
    )
    assert anon_res.status_code == 201
    anon_order_id = anon_res.json()["id"]

    # Order 2: Alice orders via browser with customer token
    alice_res = client.post(
        "/orders",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "store_slug": "brasa-burgers",
            "items": [{"product_id": "bacon-blast", "quantity": 2}],
            "dine_in": False,
            "payment_method": "pix",
        },
    )
    assert alice_res.status_code == 201
    alice_order_id = alice_res.json()["id"]

    # Order 3: Bob orders via browser with customer token
    bob_res = client.post(
        "/orders",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "store_slug": "bella-nonna",
            "items": [{"product_id": "lasanha-bolonhesa", "quantity": 1}],
            "dine_in": True,
            "payment_method": "pix",
        },
    )
    assert bob_res.status_code == 201
    bob_order_id = bob_res.json()["id"]

    # Check Alice's /orders/me: contains Alice's order, does not contain Bob's nor anonymous
    alice_orders_res = client.get(
        "/orders/me",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert alice_orders_res.status_code == 200
    alice_orders = alice_orders_res.json()
    alice_order_ids = [o["id"] for o in alice_orders]
    assert alice_order_id in alice_order_ids
    assert bob_order_id not in alice_order_ids
    assert anon_order_id not in alice_order_ids

    # Check Bob's /orders/me: contains Bob's order, does not contain Alice's nor anonymous
    bob_orders_res = client.get(
        "/orders/me",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert bob_orders_res.status_code == 200
    bob_orders = bob_orders_res.json()
    bob_order_ids = [o["id"] for o in bob_orders]
    assert bob_order_id in bob_order_ids
    assert alice_order_id not in bob_order_ids
    assert anon_order_id not in bob_order_ids


def test_order_placement_refuses_malformed_auth_header(client: TestClient) -> None:
    res = client.post(
        "/orders",
        headers={"Authorization": "InvalidScheme 1234"},
        json={
            "store_slug": "brasa-burgers",
            "items": [{"product_id": "xbrasa", "quantity": 1}],
            "dine_in": True,
            "payment_method": "card",
        },
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Formato de autorização inválido. Utilize Bearer <token>."


def test_customer_orders_me_requires_token(client: TestClient) -> None:
    res = client.get("/orders/me")
    assert res.status_code == 401
    assert res.json()["detail"] == "Token de autenticação não fornecido."
