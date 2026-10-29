from topa_api.application.ports import ProductRepository, StoreRepository
from topa_api.domain.catalog import Product
from topa_api.domain.errors import ProductNotFoundError, StoreNotFoundError


class UpdateProductUseCase:
    def __init__(self, stores: StoreRepository, products: ProductRepository) -> None:
        self._stores = stores
        self._products = products

    def execute(
        self,
        store_slug: str,
        product_id: str,
        name: str,
        description: str,
        category: str,
        price_cents: int,
        photo_url: str | None = None,
        available: bool | None = None,
    ) -> Product:
        if self._stores.get(store_slug) is None:
            raise StoreNotFoundError
        existing = self._products.get(store_slug, product_id)
        if existing is None:
            raise ProductNotFoundError
        updated = Product(
            id=product_id,
            name=name,
            description=description,
            category=category,
            price_cents=price_cents,
            photo_url=photo_url,
            available=existing.available if available is None else available,
        )
        result = self._products.update(store_slug, updated)
        if result is None:
            raise ProductNotFoundError
        return result
