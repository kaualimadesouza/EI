from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from tests.paid_orders import confirm_pix
from topa_api.adapters.db.models import MerchantRow, StoreRow

REGISTRATION = {
    "store_name": "Restaurante da Esquina",
    "email": "dono@restaurante.example",
    "password": "senha-local-123",
}


def test_new_merchant_can_run_a_shift_without_touching_another_store(client: TestClient) -> None:
    response = client.post("/auth/register", json=REGISTRATION)
    assert response.status_code == 201
    account = response.json()
    slug = account["store_slug"]
    assert slug.startswith("restaurante-da-esquina-")
    headers = {"Authorization": f"Bearer {account['access_token']}"}
    menu_url = f"/menu?loja={slug}"
    store_url = f"/stores/{slug}/ordering"
    assert client.get(menu_url).json() == {
        "store": {"slug": slug, "name": REGISTRATION["store_name"], "accepting_orders": False},
        "products": [],
    }
    assert (
        client.patch(store_url, json={"accepting_orders": True}, headers=headers).status_code == 422
    )
    product = client.post(
        f"/products?loja={slug}",
        json={
            "name": "Prato feito",
            "category": "pratos",
            "description": "Arroz e feijão",
            "price_cents": 3290,
            "available": True,
        },
        headers=headers,
    )
    assert product.status_code == 201
    order_body = {
        "store_slug": slug,
        "items": [{"product_id": product.json()["id"], "quantity": 2}],
        "dine_in": True,
        "payment_method": "pix",
    }
    assert client.post("/orders", json=order_body).status_code == 409
    assert (
        client.patch(store_url, json={"accepting_orders": True}, headers=headers).status_code == 200
    )
    assert client.get(menu_url).json()["store"]["accepting_orders"] is True
    placed = client.post("/orders", json=order_body)
    assert placed.status_code == 201
    order = placed.json()
    assert order["total_cents"] == 6580
    assert client.get(f"/orders?loja={slug}", headers=headers).json() == []
    confirm_pix(client, order["id"])
    for status in ["preparing", "ready", "delivered"]:
        updated = client.patch(f"/orders/{order['id']}", json={"status": status}, headers=headers)
        assert updated.status_code == 200
        assert updated.json()["status"] == status
    assert (
        client.patch(store_url, json={"accepting_orders": False}, headers=headers).status_code
        == 200
    )
    refused = client.post("/orders", json=order_body)
    assert refused.status_code == 409
    assert "pausou" in refused.json()["detail"]
    orders = client.get(f"/orders?loja={slug}", headers=headers).json()
    assert len(orders) == 1
    assert orders[0]["status"] == "delivered"
    assert client.get("/orders?loja=lanchonete-bem-te-vi", headers=headers).status_code == 403
    assert (
        client.patch(
            "/stores/lanchonete-bem-te-vi/ordering",
            json={"accepting_orders": False},
            headers=headers,
        ).status_code
        == 403
    )
    login = client.post(
        "/auth/login",
        json={
            "email": REGISTRATION["email"].upper(),
            "password": REGISTRATION["password"],
        },
    )
    assert login.status_code == 200
    assert login.json()["store_slug"] == slug


def test_duplicate_registration_leaves_no_orphan_store(
    client: TestClient, db_engine: Engine
) -> None:
    assert client.post("/auth/register", json=REGISTRATION).status_code == 201
    with Session(db_engine) as session:
        before = session.scalar(select(func.count()).select_from(StoreRow))
    duplicate = client.post(
        "/auth/register", json={**REGISTRATION, "email": REGISTRATION["email"].upper()}
    )
    assert duplicate.status_code == 409
    with Session(db_engine) as session:
        assert session.scalar(select(func.count()).select_from(StoreRow)) == before
        merchant = session.scalar(
            select(MerchantRow).where(MerchantRow.email == REGISTRATION["email"])
        )
        assert merchant is not None
        assert merchant.password_hash != REGISTRATION["password"]


def test_ordering_status_requires_auth_and_an_existing_store(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    assert (
        client.patch(
            "/stores/lanchonete-bem-te-vi/ordering", json={"accepting_orders": False}
        ).status_code
        == 401
    )
    assert (
        client.patch(
            "/stores/unknown/ordering", json={"accepting_orders": True}, headers=auth_headers
        ).status_code
        == 403
    )


def test_registration_is_rate_limited_even_when_data_is_invalid(client: TestClient) -> None:
    for _ in range(10):
        assert (
            client.post("/auth/register", json={**REGISTRATION, "store_name": " "}).status_code
            == 422
        )
    blocked = client.post("/auth/register", json=REGISTRATION)
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) > 0
