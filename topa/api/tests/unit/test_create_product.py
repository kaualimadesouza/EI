import pytest

from tests.fakes import InMemoryProductRepository, InMemoryStoreRepository
from topa_api.application.create_product import CreateProductUseCase
from topa_api.domain.catalog import Product, Store
from topa_api.domain.errors import DuplicateProductError, StoreNotFoundError

STORE = Store(slug="lanchonete-bem-te-vi", name="Lanchonete Bem-te-vi")
EXISTING = Product(
    id="coxinha",
    name="Coxinha",
    description="Frango.",
    category="salgados",
    price_cents=890,
    available=True,
)


@pytest.fixture
def stores() -> InMemoryStoreRepository:
    return InMemoryStoreRepository([STORE])


@pytest.fixture
def products() -> InMemoryProductRepository:
    return InMemoryProductRepository({STORE.slug: [EXISTING]})


def test_creates_product_with_explicit_id_and_photo(
    stores: InMemoryStoreRepository, products: InMemoryProductRepository
) -> None:
    use_case = CreateProductUseCase(stores, products)
    created = use_case.execute(
        store_slug=STORE.slug,
        id="pastel-carne",
        name="Pastel de Carne",
        description="Carne moída especial.",
        category="salgados",
        price_cents=950,
        photo_url="https://example.com/pastel.jpg",
        available=True,
        position=5,
    )

    assert created == Product(
        id="pastel-carne",
        name="Pastel de Carne",
        description="Carne moída especial.",
        category="salgados",
        price_cents=950,
        photo_url="https://example.com/pastel.jpg",
        available=True,
    )
    assert products.get(STORE.slug, "pastel-carne") == created


def test_creates_product_with_derived_id_and_next_position(
    stores: InMemoryStoreRepository, products: InMemoryProductRepository
) -> None:
    use_case = CreateProductUseCase(stores, products)
    created = use_case.execute(
        store_slug=STORE.slug,
        name="Suco de Uva",
        description="Integral 300ml.",
        category="bebidas",
        price_cents=800,
    )

    assert created.id == "suco-de-uva"
    assert created.available is True
    assert created.photo_url is None
    assert products.get(STORE.slug, "suco-de-uva") == created


def test_creates_product_with_fallback_id_when_name_has_no_slug_characters(
    stores: InMemoryStoreRepository, products: InMemoryProductRepository
) -> None:
    use_case = CreateProductUseCase(stores, products)
    created = use_case.execute(
        store_slug=STORE.slug,
        name="???",
        description="Sem nome legivel.",
        category="outros",
        price_cents=500,
    )

    assert created.id.startswith("p-")
    assert products.get(STORE.slug, created.id) == created


def test_refuses_creating_product_with_existing_id(
    stores: InMemoryStoreRepository, products: InMemoryProductRepository
) -> None:
    use_case = CreateProductUseCase(stores, products)
    with pytest.raises(DuplicateProductError):
        use_case.execute(
            store_slug=STORE.slug,
            id="coxinha",
            name="Coxinha",
            description="Outra coxinha.",
            category="salgados",
            price_cents=900,
        )


def test_refuses_creating_product_in_unknown_store(
    stores: InMemoryStoreRepository, products: InMemoryProductRepository
) -> None:
    use_case = CreateProductUseCase(stores, products)
    with pytest.raises(StoreNotFoundError):
        use_case.execute(
            store_slug="unknown-store",
            name="Pastel",
            description="Queijo.",
            category="salgados",
            price_cents=850,
        )
