import re
import unicodedata
import uuid

from topa_api.application.ports import ProductRepository, StoreRepository
from topa_api.domain.catalog import Product
from topa_api.domain.errors import (
    DuplicateProductError,
    InvalidProductDataError,
    StoreNotFoundError,
)


def _slugify(text: str) -> str:
    slug = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^\w\s-]", "", slug).strip().lower()
    slug = re.sub(r"[-\s]+", "-", slug)
    return slug


class CreateProductUseCase:
    def __init__(self, stores: StoreRepository, products: ProductRepository) -> None:
        self._stores = stores
        self._products = products

    def execute(
        self,
        store_slug: str,
        name: str,
        description: str,
        category: str,
        price_cents: int,
        id: str | None = None,
        photo_url: str | None = None,
        available: bool = True,
        position: int | None = None,
    ) -> Product:
        if self._stores.get(store_slug) is None:
            raise StoreNotFoundError
        clean_name = name.strip()
        clean_category = category.strip()
        if not clean_name:
            raise InvalidProductDataError("O nome do produto não pode ficar em branco.")
        if not clean_category:
            raise InvalidProductDataError("A categoria do produto não pode ficar em branco.")
        if price_cents < 0:
            raise InvalidProductDataError("O preço do produto não pode ser negativo.")
        product_id = id.strip() if id and id.strip() else _slugify(clean_name)
        if not product_id:
            product_id = f"p-{uuid.uuid4().hex[:8]}"
        if self._products.get(store_slug, product_id) is not None:
            raise DuplicateProductError
        if position is None:
            position = self._products.next_position(store_slug)
        product = Product(
            id=product_id,
            name=clean_name,
            description=description.strip(),
            category=clean_category,
            price_cents=price_cents,
            available=available,
            photo_url=photo_url.strip() if photo_url and photo_url.strip() else None,
        )
        return self._products.create(store_slug, product, position)
