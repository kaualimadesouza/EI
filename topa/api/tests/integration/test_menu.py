import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, insert

from topa_api.adapters.db.models import ProductRow, StoreRow

INVALID_REQUEST = "Não foi possível processar a solicitação. Tente de novo."


def _seed_cantina(db_engine: Engine) -> None:
    with db_engine.begin() as connection:
        connection.execute(insert(StoreRow).values(slug="cantina-central", name="Cantina Central"))
        connection.execute(
            insert(ProductRow),
            [
                {
                    "store_slug": "cantina-central",
                    "id": "coxinha",
                    "position": 1,
                    "name": "Coxinha da cantina",
                    "description": "Frango desfiado.",
                    "category": "salgados",
                    "price_cents": 950,
                    "available": True,
                },
                {
                    "store_slug": "cantina-central",
                    "id": "suco",
                    "position": 2,
                    "name": "Suco de caju",
                    "description": "Copo de 300 ml.",
                    "category": "bebidas",
                    "price_cents": 1100,
                    "available": False,
                },
            ],
        )


def test_menu_returns_the_seeded_store_and_its_products(client: TestClient) -> None:
    response = client.get("/menu", params={"loja": "lanchonete-bem-te-vi"})

    assert response.status_code == 200
    body = response.json()
    assert body["store"] == {
        "slug": "lanchonete-bem-te-vi",
        "name": "Lanchonete Bem-te-vi",
    }
    assert len(body["products"]) == 18
    assert body["products"][0]["id"] == "combo-cafe"


def test_each_store_serves_its_own_menu_and_availability(
    client: TestClient, db_engine: Engine
) -> None:
    _seed_cantina(db_engine)
    client.patch("/products/coxinha", params={"loja": "cantina-central"}, json={"available": False})

    cantina = client.get("/menu", params={"loja": "cantina-central"}).json()
    bem_te_vi = client.get("/menu", params={"loja": "lanchonete-bem-te-vi"}).json()

    assert cantina == {
        "store": {"slug": "cantina-central", "name": "Cantina Central"},
        "products": [
            {
                "id": "coxinha",
                "name": "Coxinha da cantina",
                "description": "Frango desfiado.",
                "category": "salgados",
                "price_cents": 950,
                "available": False,
            },
            {
                "id": "suco",
                "name": "Suco de caju",
                "description": "Copo de 300 ml.",
                "category": "bebidas",
                "price_cents": 1100,
                "available": False,
            },
        ],
    }
    bem_te_vi_coxinha = next(p for p in bem_te_vi["products"] if p["id"] == "coxinha")
    assert bem_te_vi_coxinha["available"] is True
    assert bem_te_vi_coxinha["price_cents"] == 890


def test_an_unknown_store_answers_not_found(client: TestClient) -> None:
    for slug in ("padaria-inexistente", "a" * 64):
        response = client.get("/menu", params={"loja": slug})
        assert response.status_code == 404
        assert response.json() == {"detail": "Loja não encontrada."}


@pytest.mark.parametrize(
    "params",
    [
        {},
        {"loja": ""},
        {"loja": "Cantina"},
        {"loja": "com espaco"},
        {"loja": "-traco"},
        {"loja": "traco-"},
        {"loja": "a" * 65},
    ],
    ids=[
        "missing",
        "empty",
        "uppercase",
        "space",
        "leading-hyphen",
        "trailing-hyphen",
        "over-64-chars",
    ],
)
def test_a_missing_or_malformed_store_slug_gets_the_generic_message(
    client: TestClient, params: dict[str, str]
) -> None:
    response = client.get("/menu", params=params)

    assert response.status_code == 422
    assert response.json() == {"detail": INVALID_REQUEST}
