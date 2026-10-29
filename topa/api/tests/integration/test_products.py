import uuid
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from topa_api.adapters.security.token_service import HmacTokenService
from topa_api.domain.auth import AuthenticatedMerchant
from topa_api.settings import Settings

INVALID_REQUEST = "Não foi possível processar a solicitação. Tente de novo."
COXINHA = {
    "id": "coxinha",
    "name": "Coxinha",
    "description": "Frango com catupiry.",
    "category": "salgados",
    "price_cents": 890,
    "photo_url": None,
}

# the seed of the products migration, in menu order: (id, category, name, description, price)
MENU = [
    ("combo-cafe", "combos", "Café + pão de queijo", "Café coado e três pães de queijo.", 1290),
    ("combo-misto", "combos", "Misto + suco", "Misto quente com suco de laranja de 300 ml.", 2290),
    ("misto", "lanches", "Misto quente", "Pão de forma, presunto e queijo na chapa.", 1490),
    ("xsalada", "lanches", "X-salada", "Hambúrguer, queijo, alface e tomate.", 2290),
    ("bauru", "lanches", "Bauru", "Rosbife, queijo, tomate e picles no pão francês.", 1890),
    ("americano", "lanches", "Americano", "Presunto, queijo, ovo, alface e tomate.", 1990),
    ("paoqueijo", "salgados", "Pão de queijo", "Porção com três unidades.", 750),
    ("coxinha", "salgados", "Coxinha", "Frango com catupiry.", 890),
    ("esfiha", "salgados", "Esfiha de carne", "Massa aberta com carne temperada.", 790),
    ("enroladinho", "salgados", "Enroladinho", "Salsicha em massa assada.", 690),
    ("cafe", "bebidas", "Café coado", "Xícara de 150 ml.", 550),
    ("suco", "bebidas", "Suco de laranja", "Natural, 300 ml.", 990),
    ("refri", "bebidas", "Refrigerante", "Copo de 350 ml com gelo.", 690),
    ("agua", "bebidas", "Água sem gás", "500 ml.", 400),
    ("bolo", "doces", "Bolo de cenoura", "Fatia com cobertura de chocolate.", 850),
    ("pudim", "doces", "Pudim", "Fatia de pudim de leite.", 990),
    ("brigadeiro", "doces", "Brigadeiro", "Unidade.", 450),
    ("brownie", "doces", "Brownie", "Com nozes.", 890),
]


def test_the_menu_lists_every_product_in_menu_order(client: TestClient) -> None:
    response = client.get("/products")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": product_id,
            "name": name,
            "description": description,
            "category": category,
            "price_cents": price_cents,
            "available": True,
            "photo_url": None,
        }
        for product_id, category, name, description, price_cents in MENU
    ]


def test_a_sold_out_product_stays_on_the_menu_marked_unavailable(
    client: TestClient, sell_out: Callable[[str], None]
) -> None:
    """The kiosk greys it out instead of hiding it, so the menu does not reshuffle."""
    sell_out("coxinha")

    products = client.get("/products").json()

    assert [product["id"] for product in products] == [row[0] for row in MENU]
    assert [product["id"] for product in products if not product["available"]] == ["coxinha"]


def test_a_product_marked_sold_out_comes_back_unavailable_and_stays_so(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client.patch("/products/coxinha", json={"available": False}, headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == {**COXINHA, "available": False}
    sold_out = [
        product["id"] for product in client.get("/products").json() if not product["available"]
    ]
    assert sold_out == ["coxinha"]


def test_a_product_back_on_sale_comes_back_available(
    client: TestClient, sell_out: Callable[[str], None], auth_headers: dict[str, str]
) -> None:
    sell_out("coxinha")

    response = client.patch("/products/coxinha", json={"available": True}, headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == {**COXINHA, "available": True}
    assert all(product["available"] for product in client.get("/products").json())


def test_the_kiosk_refuses_a_product_the_dashboard_sold_out_until_it_is_back(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    order = {
        "items": [{"product_id": "coxinha", "quantity": 1}],
        "dine_in": True,
        "payment_method": "pix",
    }

    client.patch("/products/coxinha", json={"available": False}, headers=auth_headers)
    refused = client.post("/orders", json=order)
    client.patch("/products/coxinha", json={"available": True}, headers=auth_headers)
    accepted = client.post("/orders", json=order)

    assert (refused.status_code, refused.json()) == (409, {"detail": "Coxinha esgotou."})
    assert accepted.status_code == 201


def test_an_unknown_product_is_not_found(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.patch("/products/pastel", json={"available": False}, headers=auth_headers)

    assert response.status_code == 404
    assert response.json() == {"detail": "Produto não encontrado."}


def test_products_for_an_unknown_store_are_not_found(client: TestClient) -> None:
    token = HmacTokenService(Settings().auth_secret_key).create_token(
        AuthenticatedMerchant(
            id=uuid.uuid4(), email="padaria@topa.com", store_slug="padaria-inexistente"
        )
    )
    headers = {"Authorization": f"Bearer {token}"}
    listed = client.get("/products", params={"loja": "padaria-inexistente"})
    patched = client.patch(
        "/products/coxinha",
        params={"loja": "padaria-inexistente"},
        json={"available": False},
        headers=headers,
    )

    assert (listed.status_code, listed.json()) == (404, {"detail": "Loja não encontrada."})
    assert (patched.status_code, patched.json()) == (404, {"detail": "Loja não encontrada."})


def test_products_for_a_malformed_store_slug_get_the_generic_message(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    for slug in ("", "Cantina", "a" * 65):
        listed = client.get("/products", params={"loja": slug})
        patched = client.patch(
            "/products/coxinha",
            params={"loja": slug},
            json={"available": True},
            headers=auth_headers,
        )
        assert (listed.status_code, listed.json()) == (422, {"detail": INVALID_REQUEST})
        assert (patched.status_code, patched.json()) == (422, {"detail": INVALID_REQUEST})


@pytest.mark.parametrize(
    "payload",
    [{}, {"available": "talvez"}, {"available": None}],
    ids=["no-availability", "not-a-boolean", "null"],
)
def test_a_malformed_availability_gets_the_generic_message(
    client: TestClient, payload: dict[str, object], auth_headers: dict[str, str]
) -> None:
    response = client.patch("/products/coxinha", json=payload, headers=auth_headers)

    assert response.status_code == 422
    assert response.json() == {"detail": INVALID_REQUEST}
    assert all(product["available"] for product in client.get("/products").json())


def test_merchant_can_create_a_new_product(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    payload = {
        "id": "pastel-especial",
        "name": "Pastel Especial",
        "description": "Carne com queijo.",
        "category": "pasteis",
        "price_cents": 1200,
        "photo_url": "https://images.example.com/pastel.jpg",
        "available": True,
    }
    response = client.post("/products", json=payload, headers=auth_headers)

    assert response.status_code == 201
    assert response.json() == {
        "id": "pastel-especial",
        "name": "Pastel Especial",
        "description": "Carne com queijo.",
        "category": "pasteis",
        "price_cents": 1200,
        "photo_url": "https://images.example.com/pastel.jpg",
        "available": True,
    }


def test_merchant_cannot_create_duplicate_product(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    payload = {
        "id": "coxinha",
        "name": "Coxinha Duplicada",
        "description": "Desc.",
        "category": "salgados",
        "price_cents": 890,
    }
    response = client.post("/products", json=payload, headers=auth_headers)

    assert response.status_code == 409
    assert response.json() == {"detail": "Produto já cadastrado."}


def test_create_product_rejects_cross_store_access(client: TestClient) -> None:
    token = HmacTokenService(Settings().auth_secret_key).create_token(
        AuthenticatedMerchant(id=uuid.uuid4(), email="outra@topa.com", store_slug="outra-loja")
    )
    payload = {
        "name": "Pastel",
        "description": "Desc.",
        "category": "salgados",
        "price_cents": 890,
    }
    response = client.post(
        "/products",
        params={"loja": "lanchonete-bem-te-vi"},
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Acesso não permitido para esta loja."}


def test_merchant_can_update_an_existing_product(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    client.post(
        "/products",
        json={
            "id": "pastel-de-frango",
            "name": "Pastel de Frango",
            "description": "Frango desfiado.",
            "category": "salgados",
            "price_cents": 900,
        },
        headers=auth_headers,
    )
    payload = {
        "name": "Pastel de Frango com Catupiry",
        "description": "Frango desfiado com catupiry legitimo.",
        "category": "salgados-premium",
        "price_cents": 1150,
        "photo_url": "https://images.example.com/pastel-premium.jpg",
        "available": True,
    }
    response = client.put("/products/pastel-de-frango", json=payload, headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == {
        "id": "pastel-de-frango",
        "name": "Pastel de Frango com Catupiry",
        "description": "Frango desfiado com catupiry legitimo.",
        "category": "salgados-premium",
        "price_cents": 1150,
        "photo_url": "https://images.example.com/pastel-premium.jpg",
        "available": True,
    }


def test_update_product_rejects_cross_store_access(client: TestClient) -> None:
    token = HmacTokenService(Settings().auth_secret_key).create_token(
        AuthenticatedMerchant(id=uuid.uuid4(), email="outra@topa.com", store_slug="outra-loja")
    )
    payload = {
        "name": "Coxinha",
        "description": "Desc.",
        "category": "salgados",
        "price_cents": 890,
    }
    response = client.put(
        "/products/coxinha",
        params={"loja": "lanchonete-bem-te-vi"},
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Acesso não permitido para esta loja."}


def test_update_unknown_product_returns_404(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    payload = {
        "name": "Nao Existe",
        "description": "Desc.",
        "category": "salgados",
        "price_cents": 500,
    }
    response = client.put("/products/item-inexistente", json=payload, headers=auth_headers)

    assert response.status_code == 404
    assert response.json() == {"detail": "Produto não encontrado."}
