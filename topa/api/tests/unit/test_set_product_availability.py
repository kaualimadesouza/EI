from dataclasses import replace

import pytest

from tests.fakes import InMemoryProductRepository, InMemoryStoreRepository
from topa_api.application.set_product_availability import SetProductAvailabilityUseCase
from topa_api.domain.catalog import Category, Product, Store
from topa_api.domain.errors import ProductNotFoundError, StoreNotFoundError

BEM_TE_VI = Store(slug="lanchonete-bem-te-vi", name="Lanchonete Bem-te-vi")
CANTINA = Store(slug="cantina-central", name="Cantina Central")
COXINHA = Product(
    id="coxinha",
    name="Coxinha",
    description="Frango com catupiry.",
    category=Category.SALGADOS,
    price_cents=890,
    available=True,
)


@pytest.fixture
def stores() -> InMemoryStoreRepository:
    return InMemoryStoreRepository([BEM_TE_VI, CANTINA])


@pytest.fixture
def products() -> InMemoryProductRepository:
    return InMemoryProductRepository(
        {
            BEM_TE_VI.slug: [COXINHA],
            CANTINA.slug: [COXINHA],
        }
    )


@pytest.mark.parametrize("available", [False, True])
def test_stores_the_availability_for_that_store_only(
    stores: InMemoryStoreRepository, products: InMemoryProductRepository, available: bool
) -> None:
    product = SetProductAvailabilityUseCase(stores, products).execute(
        BEM_TE_VI.slug, "coxinha", available
    )

    assert product == replace(COXINHA, available=available)
    assert products.products_by_store[BEM_TE_VI.slug] == [product]
    assert products.products_by_store[CANTINA.slug] == [COXINHA]


def test_an_unknown_product_is_reported(
    stores: InMemoryStoreRepository, products: InMemoryProductRepository
) -> None:
    with pytest.raises(ProductNotFoundError) as raised:
        SetProductAvailabilityUseCase(stores, products).execute(BEM_TE_VI.slug, "pastel", False)

    assert str(raised.value) == "Produto não encontrado."
    assert products.products_by_store[BEM_TE_VI.slug] == [COXINHA]


def test_an_unknown_store_is_reported(
    stores: InMemoryStoreRepository, products: InMemoryProductRepository
) -> None:
    with pytest.raises(StoreNotFoundError) as raised:
        SetProductAvailabilityUseCase(stores, products).execute("outra-loja", "coxinha", False)

    assert str(raised.value) == "Loja não encontrada."
