from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from topa_api.application.get_store_menu import GetStoreMenuUseCase
from topa_api.application.set_product_availability import SetProductAvailabilityUseCase
from topa_api.domain.catalog import DEFAULT_STORE_SLUG, Category, Product
from topa_api.presentation.fastapi.dependencies import (
    StoreSlug,
    get_set_product_availability_use_case,
    get_store_menu_use_case,
)
from topa_api.presentation.fastapi.errors import ErrorResponse

router = APIRouter(tags=["products"])


class AvailabilityRequest(BaseModel):
    available: bool


class StoreResponse(BaseModel):
    slug: str
    name: str


class ProductResponse(BaseModel):
    id: str
    name: str
    description: str
    category: Category
    price_cents: int
    available: bool


class StoreMenuResponse(BaseModel):
    store: StoreResponse
    products: list[ProductResponse]


@router.get(
    "/menu",
    responses={
        404: {"model": ErrorResponse, "description": "no store has that slug"},
        422: {"model": ErrorResponse, "description": "loja is missing or malformed"},
    },
)
def get_store_menu(
    store_slug: Annotated[StoreSlug, Query(alias="loja")],
    use_case: Annotated[GetStoreMenuUseCase, Depends(get_store_menu_use_case)],
) -> StoreMenuResponse:
    """One store's identity and full menu in display order, sold-out products included."""
    menu = use_case.execute(store_slug)
    return StoreMenuResponse(
        store=StoreResponse(slug=menu.store.slug, name=menu.store.name),
        products=[_product_response(product) for product in menu.products],
    )


@router.get(
    "/products",
    responses={
        404: {"model": ErrorResponse, "description": "no store has that slug"},
        422: {"model": ErrorResponse, "description": "loja is malformed"},
    },
)
def list_products(
    use_case: Annotated[GetStoreMenuUseCase, Depends(get_store_menu_use_case)],
    store_slug: Annotated[StoreSlug, Query(alias="loja")] = DEFAULT_STORE_SLUG,
) -> list[ProductResponse]:
    """The whole menu in display order; sold-out products come with available=false."""
    return [_product_response(product) for product in use_case.execute(store_slug).products]


@router.patch(
    "/products/{product_id}",
    responses={
        404: {"model": ErrorResponse, "description": "unknown store or product"},
        422: {"model": ErrorResponse, "description": "available is missing or not a boolean"},
    },
)
def set_product_availability(
    product_id: str,
    request: AvailabilityRequest,
    use_case: Annotated[
        SetProductAvailabilityUseCase, Depends(get_set_product_availability_use_case)
    ],
    store_slug: Annotated[StoreSlug, Query(alias="loja")] = DEFAULT_STORE_SLUG,
) -> ProductResponse:
    """Sold out or back on sale; the kiosk refuses a sold-out product from the next order on."""
    return _product_response(use_case.execute(store_slug, product_id, request.available))


def _product_response(product: Product) -> ProductResponse:
    return ProductResponse(
        id=product.id,
        name=product.name,
        description=product.description,
        category=product.category,
        price_cents=product.price_cents,
        available=product.available,
    )
