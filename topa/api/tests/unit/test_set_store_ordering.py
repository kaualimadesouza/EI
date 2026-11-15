import pytest

from tests.fakes import InMemoryProductRepository, InMemoryStoreRepository
from topa_api.application.set_store_ordering import SetStoreOrderingUseCase
from topa_api.domain.catalog import Product, Store
from topa_api.domain.errors import InvalidProductDataError, StoreNotFoundError


def test_unknown_store_cannot_be_opened_or_paused() -> None:
    use_case = SetStoreOrderingUseCase(InMemoryStoreRepository([]), InMemoryProductRepository({}))
    with pytest.raises(StoreNotFoundError):
        use_case.execute("unknown", True)


def test_store_without_available_products_cannot_open() -> None:
    stores = InMemoryStoreRepository([Store("loja", "Loja", accepting_orders=False)])
    products = InMemoryProductRepository({"loja": [Product("pf", "PF", "", "pratos", 1000, False)]})
    use_case = SetStoreOrderingUseCase(stores, products)
    with pytest.raises(InvalidProductDataError, match="produto à venda"):
        use_case.execute("loja", True)


def test_store_deleted_during_status_change_is_reported_as_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stores = InMemoryStoreRepository([Store("loja", "Loja")])
    monkeypatch.setattr(stores, "set_accepting_orders", lambda slug, accepting: None)
    with pytest.raises(StoreNotFoundError):
        SetStoreOrderingUseCase(stores, InMemoryProductRepository({})).execute("loja", False)
