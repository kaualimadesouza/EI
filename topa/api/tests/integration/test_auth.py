import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import Engine, insert
from sqlalchemy.orm import Session

from topa_api.adapters.db.models import StoreRow
from topa_api.adapters.db.repositories import SqlAlchemyMerchantRepository
from topa_api.adapters.security.password_hasher import ScryptPasswordHasher
from topa_api.domain.auth import Merchant

DEFAULT_EMAIL = "admin@bemtevi.topa.com"
DEFAULT_STORE = "lanchonete-bem-te-vi"


def _login(client: TestClient, email: str = DEFAULT_EMAIL, password: str = "topa123") -> str:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    data = response.json()
    return str(data["access_token"])


def test_login_with_valid_credentials_returns_access_token(client: TestClient) -> None:
    response = client.post("/auth/login", json={"email": DEFAULT_EMAIL, "password": "topa123"})
    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["store_slug"] == DEFAULT_STORE
    assert data["email"] == DEFAULT_EMAIL
    assert len(data["access_token"]) > 20


def test_login_with_wrong_password_returns_401(client: TestClient) -> None:
    response = client.post(
        "/auth/login", json={"email": DEFAULT_EMAIL, "password": "wrongpassword"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "E-mail ou senha incorretos."


def test_login_with_unknown_email_returns_401(client: TestClient) -> None:
    response = client.post(
        "/auth/login", json={"email": "nobody@nowhere.com", "password": "topa123"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "E-mail ou senha incorretos."


def test_protected_routes_refuse_missing_or_malformed_auth_header(client: TestClient) -> None:
    # Missing authorization header
    res1 = client.get("/orders")
    assert res1.status_code == 401
    assert res1.json()["detail"] == "Token de autenticação não fornecido."

    # Malformed format (not Bearer)
    res2 = client.get("/orders", headers={"Authorization": "Basic 123456"})
    assert res2.status_code == 401
    assert res2.json()["detail"] == "Formato de autorização inválido. Utilize Bearer <token>."

    # Bad Bearer token
    res3 = client.get("/orders", headers={"Authorization": "Bearer bad_token"})
    assert res3.status_code == 401
    assert res3.json()["detail"] == "Sessão inválida ou expirada."


def test_protected_routes_refuse_cross_store_access(client: TestClient, db_engine: Engine) -> None:

    # Seed a secondary store and merchant
    other_merchant_id = uuid.uuid4()
    with Session(db_engine) as session, session.begin():
        session.execute(insert(StoreRow).values(slug="outra-loja", name="Outra Loja"))
        repo = SqlAlchemyMerchantRepository(session)
        hasher = ScryptPasswordHasher()
        repo.add(
            Merchant(
                id=other_merchant_id,
                email="outra@topa.com",
                store_slug="outra-loja",
                created_at=datetime.now(UTC),
            ),
            hasher.hash_password("senha123"),
        )

    # Login as other store merchant
    other_token = _login(client, email="outra@topa.com", password="senha123")

    # Trying to list orders for lanchonete-bem-te-vi with other store token
    res_orders = client.get(
        f"/orders?loja={DEFAULT_STORE}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res_orders.status_code == 403
    assert res_orders.json()["detail"] == "Acesso não permitido para esta loja."

    # Trying to toggle product availability for default store
    res_prod = client.patch(
        f"/products/cafe?loja={DEFAULT_STORE}",
        json={"available": False},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res_prod.status_code == 403
    assert res_prod.json()["detail"] == "Acesso não permitido para esta loja."

    # Trying to modify an order specifying another store in query
    res_order_mismatch = client.patch(
        f"/orders/{uuid.uuid4()}?loja=outra-loja",
        json={"status": "preparing"},
        headers=_auth_header_for(client),
    )
    assert res_order_mismatch.status_code == 403
    assert res_order_mismatch.json()["detail"] == "Acesso não permitido para esta loja."

    # Modifying an order with matching store in query
    placed = client.post(
        "/orders",
        json={
            "store_slug": DEFAULT_STORE,
            "items": [{"product_id": "cafe", "quantity": 1}],
            "dine_in": True,
            "payment_method": "pix",
        },
    ).json()
    res_order_match = client.patch(
        f"/orders/{placed['id']}?loja={DEFAULT_STORE}",
        json={"status": "preparing"},
        headers=_auth_header_for(client),
    )
    assert res_order_match.status_code == 200
    assert res_order_match.json()["status"] == "preparing"


def _auth_header_for(client: TestClient) -> dict[str, str]:
    token = _login(client, email=DEFAULT_EMAIL, password="topa123")
    return {"Authorization": f"Bearer {token}"}


def test_public_routes_remain_accessible_without_auth(client: TestClient) -> None:
    assert client.get("/health").status_code == 200
    assert client.get("/health/ready").status_code == 200
    assert client.get(f"/menu?loja={DEFAULT_STORE}").status_code == 200
    assert client.get(f"/products?loja={DEFAULT_STORE}").status_code == 200
    # An unknown order returns 404, proving the route does not require auth
    random_order_id = uuid.uuid4()
    assert client.get(f"/orders/{random_order_id}").status_code == 404
