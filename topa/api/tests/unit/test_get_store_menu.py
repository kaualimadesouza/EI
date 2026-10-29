import pytest

from tests.fakes import InMemoryProductRepository, InMemoryStoreRepository
from topa_api.application.get_store_menu import GetStoreMenuUseCase
from topa_api.domain.catalog import Category, Product, Store, StoreMenu
from topa_api.domain.errors import StoreNotFoundError

BEM_TE_VI = Store(slug="lanchonete-bem-te-vi", name="Lanchonete Bem-te-vi")
CANTINA = Store(slug="cantina-central", name="Cantina Central")
CAFE = Product(
    id="cafe",
    name="Café coado",
    description="Xícara de 150 ml.",
    category=Category.BEBIDAS,
    price_cents=550,
    available=True,
)
SUCO = Product(
    id="suco",
    name="Suco natural",
    description="Copo de 300 ml.",
    category=Category.BEBIDAS,
    price_cents=1100,
    available=False,
)


def test_returns_the_store_and_only_its_products_in_menu_order() -> None:
    stores = InMemoryStoreRepository(stores=[BEM_TE_VI, CANTINA])
    products = InMemoryProductRepository(
        products_by_store={
            BEM_TE_VI.slug: [CAFE],
            CANTINA.slug: [SUCO],
        }
    )

    menu = GetStoreMenuUseCase(stores, products).execute(CANTINA.slug)

    assert menu == StoreMenu(store=CANTINA, products=(SUCO,))


def test_an_unknown_store_is_reported() -> None:
    stores = InMemoryStoreRepository(stores=[BEM_TE_VI])
    products = InMemoryProductRepository(products_by_store={BEM_TE_VI.slug: [CAFE]})

    with pytest.raises(StoreNotFoundError) as raised:
        GetStoreMenuUseCase(stores, products).execute("padaria-esquina")

    assert str(raised.value) == "Loja não encontrada."
