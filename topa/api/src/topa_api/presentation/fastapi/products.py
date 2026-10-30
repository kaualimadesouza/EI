from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, field_validator

from topa_api.application.create_product import CreateProductUseCase
from topa_api.application.get_store_menu import GetStoreMenuUseCase
from topa_api.application.set_product_availability import SetProductAvailabilityUseCase
from topa_api.application.update_product import UpdateProductUseCase
from topa_api.domain.auth import AuthenticatedMerchant
from topa_api.domain.catalog import DEFAULT_STORE_SLUG, Product
from topa_api.domain.errors import ForbiddenStoreAccessError
from topa_api.presentation.fastapi.dependencies import (
    StoreSlug,
    get_create_product_use_case,
    get_current_merchant,
    get_set_product_availability_use_case,
    get_store_menu_use_case,
    get_update_product_use_case,
)
from topa_api.presentation.fastapi.errors import ErrorResponse

router = APIRouter(tags=["products"])


def _clean_non_empty(v: str) -> str:
    cleaned = v.strip()
    if not cleaned:
        raise ValueError("cannot be empty or whitespace only")
    return cleaned


def _clean_photo_url(v: str | None) -> str | None:
    if not v or not v.strip():
        return None
    cleaned = v.strip()
    if not (
        cleaned.startswith("http://") or cleaned.startswith("https://") or cleaned.startswith("/")
    ):
        raise ValueError("photo_url must start with http://, https://, or /")
    return cleaned


class AvailabilityRequest(BaseModel):
    available: bool


class CreateProductRequest(BaseModel):
    id: str | None = None
    name: str = Field(min_length=1)
    description: str = ""
    category: str = Field(min_length=1)
    price_cents: int = Field(ge=0)
    photo_url: str | None = None
    available: bool = True
    position: int | None = Field(default=None, ge=0)

    @field_validator("name", "category")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        return _clean_non_empty(v)

    @field_validator("photo_url")
    @classmethod
    def validate_photo_url(cls, v: str | None) -> str | None:
        return _clean_photo_url(v)


class UpdateProductRequest(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    category: str = Field(min_length=1)
    price_cents: int = Field(ge=0)
    photo_url: str | None = None
    available: bool | None = None

    @field_validator("name", "category")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        return _clean_non_empty(v)

    @field_validator("photo_url")
    @classmethod
    def validate_photo_url(cls, v: str | None) -> str | None:
        return _clean_photo_url(v)


class StoreResponse(BaseModel):
    slug: str
    name: str


class ProductResponse(BaseModel):
    id: str
    name: str
    description: str
    category: str
    price_cents: int
    available: bool
    photo_url: str | None = None


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


@router.post(
    "/products",
    status_code=201,
    responses={
        401: {"model": ErrorResponse, "description": "missing or invalid auth token"},
        403: {"model": ErrorResponse, "description": "merchant does not belong to this store"},
        404: {"model": ErrorResponse, "description": "unknown store"},
        409: {"model": ErrorResponse, "description": "product id already exists"},
        422: {"model": ErrorResponse, "description": "invalid product data"},
    },
)
def create_product(
    request: CreateProductRequest,
    use_case: Annotated[CreateProductUseCase, Depends(get_create_product_use_case)],
    merchant: Annotated[AuthenticatedMerchant, Depends(get_current_merchant)],
    store_slug: Annotated[StoreSlug, Query(alias="loja")] = DEFAULT_STORE_SLUG,
) -> ProductResponse:
    """Creates a new product in the store catalog."""
    if merchant.store_slug != store_slug:
        raise ForbiddenStoreAccessError()
    product = use_case.execute(
        store_slug=store_slug,
        id=request.id,
        name=request.name,
        description=request.description,
        category=request.category,
        price_cents=request.price_cents,
        photo_url=request.photo_url,
        available=request.available,
        position=request.position,
    )
    return _product_response(product)


@router.put(
    "/products/{product_id}",
    responses={
        401: {"model": ErrorResponse, "description": "missing or invalid auth token"},
        403: {"model": ErrorResponse, "description": "merchant does not belong to this store"},
        404: {"model": ErrorResponse, "description": "unknown store or product"},
        422: {"model": ErrorResponse, "description": "invalid product data"},
    },
)
def update_product(
    product_id: str,
    request: UpdateProductRequest,
    use_case: Annotated[UpdateProductUseCase, Depends(get_update_product_use_case)],
    merchant: Annotated[AuthenticatedMerchant, Depends(get_current_merchant)],
    store_slug: Annotated[StoreSlug, Query(alias="loja")] = DEFAULT_STORE_SLUG,
) -> ProductResponse:
    """Updates fields of an existing product."""
    if merchant.store_slug != store_slug:
        raise ForbiddenStoreAccessError()
    product = use_case.execute(
        store_slug=store_slug,
        product_id=product_id,
        name=request.name,
        description=request.description,
        category=request.category,
        price_cents=request.price_cents,
        photo_url=request.photo_url,
        available=request.available,
    )
    return _product_response(product)


@router.patch(
    "/products/{product_id}",
    responses={
        401: {"model": ErrorResponse, "description": "missing or invalid auth token"},
        403: {"model": ErrorResponse, "description": "merchant does not belong to this store"},
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
    merchant: Annotated[AuthenticatedMerchant, Depends(get_current_merchant)],
    store_slug: Annotated[StoreSlug, Query(alias="loja")] = DEFAULT_STORE_SLUG,
) -> ProductResponse:
    """Sold out or back on sale; the kiosk refuses a sold-out product from the next order on."""
    if merchant.store_slug != store_slug:
        raise ForbiddenStoreAccessError()
    return _product_response(use_case.execute(store_slug, product_id, request.available))


def _product_response(product: Product) -> ProductResponse:
    return ProductResponse(
        id=product.id,
        name=product.name,
        description=product.description,
        category=product.category,
        price_cents=product.price_cents,
        available=product.available,
        photo_url=product.photo_url,
    )
