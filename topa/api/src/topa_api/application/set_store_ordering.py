from topa_api.application.ports import ProductRepository, StoreRepository
from topa_api.domain.catalog import Store
from topa_api.domain.errors import InvalidProductDataError, StoreNotFoundError


class SetStoreOrderingUseCase:
    def __init__(self, stores: StoreRepository, products: ProductRepository) -> None:
        self._stores = stores
        self._products = products

    def execute(self, slug: str, accepting: bool) -> Store:
        if self._stores.get(slug) is None:
            raise StoreNotFoundError
        if accepting and not any(p.available for p in self._products.list_for_store(slug)):
            raise InvalidProductDataError(
                "Cadastre pelo menos um produto à venda antes de abrir a loja."
            )
        updated = self._stores.set_accepting_orders(slug, accepting)
        if updated is None:
            raise StoreNotFoundError
        return updated
