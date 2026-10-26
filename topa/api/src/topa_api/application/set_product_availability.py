from topa_api.application.ports import ProductRepository
from topa_api.domain.catalog import Product
from topa_api.domain.errors import ProductNotFoundError


class SetProductAvailabilityUseCase:
    def __init__(self, products: ProductRepository) -> None:
        self._products = products

    def execute(self, product_id: str, available: bool) -> Product:
        product = self._products.set_availability(product_id, available)
        if product is None:
            raise ProductNotFoundError
        return product
