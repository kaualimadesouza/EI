from dataclasses import replace

import pytest

from tests.fakes import InMemoryProductRepository
from topa_api.application.set_product_availability import SetProductAvailabilityUseCase
from topa_api.domain.catalog import Category, Product
from topa_api.domain.errors import ProductNotFoundError

COXINHA = Product(
    id="coxinha",
    name="Coxinha",
    description="Frango com catupiry.",
    category=Category.SALGADOS,
    price_cents=890,
    available=True,
)


@pytest.fixture
def products() -> InMemoryProductRepository:
    return InMemoryProductRepository([COXINHA])


@pytest.mark.parametrize("available", [False, True])
def test_stores_the_availability_and_returns_the_product(
    products: InMemoryProductRepository, available: bool
) -> None:
    product = SetProductAvailabilityUseCase(products).execute("coxinha", available)

    assert product == replace(COXINHA, available=available)
    assert products.products == [product]


def test_an_unknown_product_is_reported(products: InMemoryProductRepository) -> None:
    with pytest.raises(ProductNotFoundError) as raised:
        SetProductAvailabilityUseCase(products).execute("pastel", False)

    assert str(raised.value) == "Produto não encontrado."
    assert products.products == [COXINHA]
