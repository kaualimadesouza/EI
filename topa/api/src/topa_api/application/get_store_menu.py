from topa_api.application.ports import ProductRepository, StoreRepository
from topa_api.domain.catalog import StoreMenu
from topa_api.domain.errors import StoreNotFoundError


class GetStoreMenuUseCase:
    def __init__(self, stores: StoreRepository, products: ProductRepository) -> None:
        self._stores = stores
        self._products = products

    def execute(self, store_slug: str) -> StoreMenu:
        store = self._stores.get(store_slug)
        if store is None:
            raise StoreNotFoundError
        return StoreMenu(
            store=store,
            products=tuple(self._products.list_for_store(store.slug)),
        )
