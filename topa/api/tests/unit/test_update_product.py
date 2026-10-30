import pytest

from tests.fakes import InMemoryProductRepository, InMemoryStoreRepository
from topa_api.application.update_product import UpdateProductUseCase
from topa_api.domain.catalog import Product, Store
from topa_api.domain.errors import (
    InvalidProductDataError,
    ProductNotFoundError,
    StoreNotFoundError,
)

STORE = Store(slug="lanchonete-bem-te-vi", name="Lanchonete Bem-te-vi")
EXISTING = Product(
    id="coxinha",
    name="Coxinha",
    description="Frango.",
    category="salgados",
    price_cents=890,
    available=True,
    photo_url=None,
)


@pytest.fixture
def stores() -> InMemoryStoreRepository:
    return InMemoryStoreRepository([STORE])


@pytest.fixture
def products() -> InMemoryProductRepository:
    return InMemoryProductRepository({STORE.slug: [EXISTING]})


def test_updates_product_fields_and_availability(
    stores: InMemoryStoreRepository, products: InMemoryProductRepository
) -> None:
    use_case = UpdateProductUseCase(stores, products)
    updated = use_case.execute(
        store_slug=STORE.slug,
        product_id="coxinha",
        name="Coxinha Especial",
        description="Frango com requeijao cremoso.",
        category="salgados-especiais",
        price_cents=1050,
        photo_url="https://example.com/coxinha.jpg",
        available=False,
    )

    assert updated == Product(
        id="coxinha",
        name="Coxinha Especial",
        description="Frango com requeijao cremoso.",
        category="salgados-especiais",
        price_cents=1050,
        photo_url="https://example.com/coxinha.jpg",
        available=False,
    )
    assert products.get(STORE.slug, "coxinha") == updated


def test_updates_product_preserving_existing_availability_when_none(
    stores: InMemoryStoreRepository, products: InMemoryProductRepository
) -> None:
    use_case = UpdateProductUseCase(stores, products)
    updated = use_case.execute(
        store_slug=STORE.slug,
        product_id="coxinha",
        name="Coxinha de Frango",
        description="Receita tradicional.",
        category="salgados",
        price_cents=900,
        available=None,
    )

    assert updated.available is True
    assert updated.name == "Coxinha de Frango"


def test_refuses_updating_product_in_unknown_store(
    stores: InMemoryStoreRepository, products: InMemoryProductRepository
) -> None:
    use_case = UpdateProductUseCase(stores, products)
    with pytest.raises(StoreNotFoundError):
        use_case.execute(
            store_slug="unknown-store",
            product_id="coxinha",
            name="Coxinha",
            description="Frango.",
            category="salgados",
            price_cents=900,
        )


def test_refuses_updating_unknown_product(
    stores: InMemoryStoreRepository, products: InMemoryProductRepository
) -> None:
    use_case = UpdateProductUseCase(stores, products)
    with pytest.raises(ProductNotFoundError):
        use_case.execute(
            store_slug=STORE.slug,
            product_id="unknown-item",
            name="Item",
            description="Desc.",
            category="geral",
            price_cents=500,
        )


def test_raises_when_repository_fails_to_update(stores: InMemoryStoreRepository) -> None:
    class FailingProductRepository(InMemoryProductRepository):
        def update(self, store_slug: str, product: Product) -> Product | None:
            return None

    repo = FailingProductRepository({STORE.slug: [EXISTING]})
    use_case = UpdateProductUseCase(stores, repo)
    with pytest.raises(ProductNotFoundError):
        use_case.execute(
            store_slug=STORE.slug,
            product_id="coxinha",
            name="Coxinha",
            description="Desc.",
            category="salgados",
            price_cents=900,
        )


def test_refuses_updating_product_with_invalid_data(
    stores: InMemoryStoreRepository, products: InMemoryProductRepository
) -> None:
    use_case = UpdateProductUseCase(stores, products)
    with pytest.raises(InvalidProductDataError, match="nome do produto"):
        use_case.execute(
            store_slug=STORE.slug,
            product_id="coxinha",
            name="   ",
            description="Sem nome.",
            category="salgados",
            price_cents=800,
        )
    with pytest.raises(InvalidProductDataError, match="categoria do produto"):
        use_case.execute(
            store_slug=STORE.slug,
            product_id="coxinha",
            name="Coxinha",
            description="Sem categoria.",
            category="   ",
            price_cents=800,
        )
    with pytest.raises(InvalidProductDataError, match="não pode ser negativo"):
        use_case.execute(
            store_slug=STORE.slug,
            product_id="coxinha",
            name="Coxinha",
            description="Preço negativo.",
            category="salgados",
            price_cents=-50,
        )
