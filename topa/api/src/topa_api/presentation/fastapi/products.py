from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from topa_api.application.ports import ProductRepository
from topa_api.application.set_product_availability import SetProductAvailabilityUseCase
from topa_api.domain.catalog import Category, Product
from topa_api.presentation.fastapi.dependencies import (
    get_product_repository,
    get_set_product_availability_use_case,
)
from topa_api.presentation.fastapi.errors import ErrorResponse

router = APIRouter(tags=["products"])


class AvailabilityRequest(BaseModel):
    available: bool


class ProductResponse(BaseModel):
    id: str
    name: str
    description: str
    category: Category
    price_cents: int
    available: bool


@router.get("/products")
def list_products(
    products: Annotated[ProductRepository, Depends(get_product_repository)],
) -> list[ProductResponse]:
    """The whole menu in display order; sold-out products come with available=false."""
    return [_product_response(product) for product in products.list_all()]


@router.patch(
    "/products/{product_id}",
    responses={
        404: {"model": ErrorResponse, "description": "no product has that id"},
        422: {"model": ErrorResponse, "description": "available is missing or not a boolean"},
    },
)
def set_product_availability(
    product_id: str,
    request: AvailabilityRequest,
    use_case: Annotated[
        SetProductAvailabilityUseCase, Depends(get_set_product_availability_use_case)
    ],
) -> ProductResponse:
    """Sold out or back on sale; the kiosk refuses a sold-out product from the next order on."""
    return _product_response(use_case.execute(product_id, request.available))


def _product_response(product: Product) -> ProductResponse:
    return ProductResponse(
        id=product.id,
        name=product.name,
        description=product.description,
        category=product.category,
        price_cents=product.price_cents,
        available=product.available,
    )
