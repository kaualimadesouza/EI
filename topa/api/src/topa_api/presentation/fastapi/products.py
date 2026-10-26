from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from topa_api.application.ports import ProductRepository
from topa_api.domain.catalog import Category
from topa_api.presentation.fastapi.dependencies import get_product_repository

router = APIRouter(tags=["products"])


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
    return [
        ProductResponse(
            id=product.id,
            name=product.name,
            description=product.description,
            category=product.category,
            price_cents=product.price_cents,
            available=product.available,
        )
        for product in products.list_all()
    ]
