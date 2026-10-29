from topa_api.application.ports import ProductRepository, StoreRepository
from topa_api.domain.catalog import Product
from topa_api.domain.errors import ProductNotFoundError, StoreNotFoundError


class SetProductAvailabilityUseCase:
    def __init__(self, stores: StoreRepository, products: ProductRepository) -> None:
        self._stores = stores
        self._products = products

    def execute(self, store_slug: str, product_id: str, available: bool) -> Product:
        if self._stores.get(store_slug) is None:
            raise StoreNotFoundError
        product = self._products.set_availability(store_slug, product_id, available)
        if product is None:
            raise ProductNotFoundError
        return product
