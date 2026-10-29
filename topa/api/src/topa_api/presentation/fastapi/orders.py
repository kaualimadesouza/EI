import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from topa_api.application.change_order_status import ChangeOrderStatusUseCase
from topa_api.application.check_order_rate_limit import CheckOrderRateLimitUseCase
from topa_api.application.list_orders import ListOrdersUseCase
from topa_api.application.place_order import PlaceOrder, PlaceOrderUseCase
from topa_api.application.read_order import ReadOrderUseCase
from topa_api.domain.auth import AuthenticatedMerchant
from topa_api.domain.catalog import DEFAULT_STORE_SLUG
from topa_api.domain.errors import ForbiddenStoreAccessError
from topa_api.domain.orders import Order, OrderLine, OrderStatus, PaymentMethod
from topa_api.presentation.fastapi.dependencies import (
    StoreSlug,
    get_change_order_status_use_case,
    get_check_order_rate_limit_use_case,
    get_current_merchant,
    get_list_orders_use_case,
    get_place_order_use_case,
    get_read_order_use_case,
)
from topa_api.presentation.fastapi.errors import ErrorResponse

router = APIRouter(tags=["orders"])


class OrderItemRequest(BaseModel):
    """No price on purpose: the server prices every item from the catalog."""

    product_id: str
    quantity: int


class PlaceOrderRequest(BaseModel):
    store_slug: StoreSlug = DEFAULT_STORE_SLUG
    items: list[OrderItemRequest]
    dine_in: bool
    payment_method: PaymentMethod


class ChangeStatusRequest(BaseModel):
    status: OrderStatus


class OrderItemResponse(BaseModel):
    product_id: str
    name: str
    quantity: int
    unit_price_cents: int


class OrderResponse(BaseModel):
    id: uuid.UUID
    store_slug: str
    number: int
    status: OrderStatus
    dine_in: bool
    payment_method: PaymentMethod
    total_cents: int
    created_at: datetime
    items: list[OrderItemResponse]


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            return parts[-1]
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


@router.post(
    "/orders",
    status_code=201,
    responses={
        404: {"model": ErrorResponse, "description": "no store has that slug"},
        409: {"model": ErrorResponse, "description": "a product sold out, or a retry is needed"},
        422: {"model": ErrorResponse, "description": "empty order, bad quantity, unknown product"},
        429: {"model": ErrorResponse, "description": "rate limit exceeded for client ip"},
    },
)
def place_order(
    request_obj: Request,
    request: PlaceOrderRequest,
    use_case: Annotated[PlaceOrderUseCase, Depends(get_place_order_use_case)],
    rate_limit: Annotated[CheckOrderRateLimitUseCase, Depends(get_check_order_rate_limit_use_case)],
) -> OrderResponse:
    rate_limit.execute(_client_ip(request_obj))
    order = use_case.execute(
        PlaceOrder(
            store_slug=request.store_slug,
            lines=tuple(
                OrderLine(product_id=item.product_id, quantity=item.quantity)
                for item in request.items
            ),
            dine_in=request.dine_in,
            payment_method=request.payment_method,
        )
    )
    return _order_response(order)


@router.get(
    "/orders",
    responses={
        401: {"model": ErrorResponse, "description": "missing or invalid auth token"},
        403: {"model": ErrorResponse, "description": "merchant does not belong to this store"},
        404: {"model": ErrorResponse, "description": "no store has that slug"},
        422: {"model": ErrorResponse, "description": "the date is not YYYY-MM-DD"},
    },
)
def list_orders(
    use_case: Annotated[ListOrdersUseCase, Depends(get_list_orders_use_case)],
    merchant: Annotated[AuthenticatedMerchant, Depends(get_current_merchant)],
    business_date: Annotated[date | None, Query(alias="date")] = None,
    store_slug: Annotated[StoreSlug, Query(alias="loja")] = DEFAULT_STORE_SLUG,
) -> list[OrderResponse]:
    """A business day's orders by number: today in São Paulo unless `date` names another."""
    if merchant.store_slug != store_slug:
        raise ForbiddenStoreAccessError()
    return [_order_response(order) for order in use_case.execute(store_slug, business_date)]


@router.get(
    "/orders/{order_id}",
    responses={
        404: {"model": ErrorResponse, "description": "no order has that id"},
        422: {"model": ErrorResponse, "description": "malformed id"},
    },
)
def read_order(
    order_id: uuid.UUID,
    use_case: Annotated[ReadOrderUseCase, Depends(get_read_order_use_case)],
) -> OrderResponse:
    """One order as it stands now: the customer's phone follows it until it is ready."""
    return _order_response(use_case.execute(order_id))


@router.patch(
    "/orders/{order_id}",
    responses={
        401: {"model": ErrorResponse, "description": "missing or invalid auth token"},
        403: {"model": ErrorResponse, "description": "merchant does not belong to this store"},
        404: {"model": ErrorResponse, "description": "no order has that id"},
        409: {"model": ErrorResponse, "description": "not one step forward or back"},
        422: {"model": ErrorResponse, "description": "unknown status or malformed id"},
    },
)
def change_order_status(
    order_id: uuid.UUID,
    request: ChangeStatusRequest,
    use_case: Annotated[ChangeOrderStatusUseCase, Depends(get_change_order_status_use_case)],
    merchant: Annotated[AuthenticatedMerchant, Depends(get_current_merchant)],
    store_slug: Annotated[StoreSlug | None, Query(alias="loja")] = None,
) -> OrderResponse:
    target_store = store_slug if store_slug is not None else merchant.store_slug
    if merchant.store_slug != target_store:
        raise ForbiddenStoreAccessError()
    return _order_response(
        use_case.execute(order_id, request.status, store_slug=merchant.store_slug)
    )


def _order_response(order: Order) -> OrderResponse:
    return OrderResponse(
        id=order.id,
        store_slug=order.store_slug,
        number=order.number,
        status=order.status,
        dine_in=order.dine_in,
        payment_method=order.payment_method,
        total_cents=order.total_cents,
        created_at=order.created_at,
        items=[
            OrderItemResponse(
                product_id=item.product_id,
                name=item.name,
                quantity=item.quantity,
                unit_price_cents=item.unit_price_cents,
            )
            for item in order.items
        ],
    )
