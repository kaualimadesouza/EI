from sqlalchemy import Engine
from sqlalchemy.orm import Session

from topa_api.adapters.db.repositories import (
    SqlAlchemyCatalogRepository,
    SqlAlchemyProductRepository,
)
from topa_api.domain.catalog import Product

STORE = "lanchonete-bem-te-vi"


def test_product_repository_alias() -> None:
    assert SqlAlchemyCatalogRepository is SqlAlchemyProductRepository


def test_get_existing_and_missing_product(db_engine: Engine) -> None:
    with Session(db_engine) as session:
        repo = SqlAlchemyProductRepository(session)
        product = repo.get(STORE, "coxinha")
        missing = repo.get(STORE, "inexistente")

    assert product is not None
    assert product.id == "coxinha"
    assert missing is None


def test_next_position_and_create_product(db_engine: Engine) -> None:
    with Session(db_engine) as session, session.begin():
        repo = SqlAlchemyProductRepository(session)
        next_pos = repo.next_position(STORE)
        assert next_pos > 18

        new_product = Product(
            id="empada-frango",
            name="Empada de Frango",
            description="Empada crocante.",
            category="salgados",
            price_cents=900,
            available=True,
            photo_url="https://example.com/empada.jpg",
        )
        created = repo.create(STORE, new_product, next_pos)

    assert created == new_product
    with Session(db_engine) as session:
        repo = SqlAlchemyProductRepository(session)
        fetched = repo.get(STORE, "empada-frango")
        assert fetched == new_product


def test_update_existing_and_missing_product(db_engine: Engine) -> None:
    with Session(db_engine) as session, session.begin():
        repo = SqlAlchemyProductRepository(session)
        pos = repo.next_position(STORE)
        repo.create(
            STORE,
            Product(
                id="quiche",
                name="Quiche",
                description="Alho poro.",
                category="salgados",
                price_cents=900,
                available=True,
            ),
            pos,
        )
        updated = repo.update(
            STORE,
            Product(
                id="quiche",
                name="Quiche Especial",
                description="Alho poro com queijo.",
                category="salgados-especiais",
                price_cents=1000,
                available=False,
                photo_url="https://example.com/quiche.jpg",
            ),
        )
        missing = repo.update(
            STORE,
            Product(
                id="inexistente",
                name="Nao existe",
                description="",
                category="outros",
                price_cents=100,
                available=True,
            ),
        )

    assert updated is not None
    assert updated.name == "Quiche Especial"
    assert updated.available is False
    assert updated.photo_url == "https://example.com/quiche.jpg"
    assert missing is None
