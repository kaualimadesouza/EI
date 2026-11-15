from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from topa_api.application.list_stores import ListStoresUseCase
from topa_api.application.set_store_ordering import SetStoreOrderingUseCase
from topa_api.domain.auth import AuthenticatedMerchant
from topa_api.domain.errors import ForbiddenStoreAccessError
from topa_api.presentation.fastapi.dependencies import (
    StoreSlug,
    get_current_merchant,
    get_list_stores_use_case,
    get_set_store_ordering_use_case,
)

router = APIRouter(tags=["stores"])


class StoreResponse(BaseModel):
    slug: str
    name: str
    latitude: float | None = None
    longitude: float | None = None
    address: str | None = None
    category: str | None = None
    segment: str = "restaurant"
    accepting_orders: bool = True


class OrderingRequest(BaseModel):
    accepting_orders: bool


@router.patch("/stores/{store_slug}/ordering")
def set_store_ordering(
    store_slug: StoreSlug,
    request: OrderingRequest,
    merchant: Annotated[AuthenticatedMerchant, Depends(get_current_merchant)],
    use_case: Annotated[SetStoreOrderingUseCase, Depends(get_set_store_ordering_use_case)],
) -> StoreResponse:
    if merchant.store_slug != store_slug:
        raise ForbiddenStoreAccessError()
    store = use_case.execute(store_slug, request.accepting_orders)
    return StoreResponse(slug=store.slug, name=store.name, accepting_orders=store.accepting_orders)


@router.get("/stores")
def list_stores(
    use_case: Annotated[ListStoresUseCase, Depends(get_list_stores_use_case)],
    segment: str | None = None,
) -> list[StoreResponse]:
    """Lists all registered stores for selection in the browser."""
    stores = use_case.execute()
    if segment:
        stores = [s for s in stores if s.segment == segment]
    return [
        StoreResponse(
            slug=store.slug,
            name=store.name,
            latitude=store.latitude,
            longitude=store.longitude,
            address=store.address,
            category=store.category,
            segment=store.segment,
            accepting_orders=store.accepting_orders,
        )
        for store in stores
    ]
