import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from topa_api.application.change_order_status import ChangeOrderStatusUseCase
from topa_api.application.list_orders import ListOrdersUseCase
from topa_api.application.place_order import PlaceOrder, PlaceOrderUseCase
from topa_api.domain.orders import Order, OrderLine, OrderStatus, PaymentMethod
from topa_api.presentation.fastapi.dependencies import (
    get_change_order_status_use_case,
    get_list_orders_use_case,
    get_place_order_use_case,
)
from topa_api.presentation.fastapi.errors import ErrorResponse

router = APIRouter(tags=["orders"])


class OrderItemRequest(BaseModel):
    """No price on purpose: the server prices every item from the catalog."""

    product_id: str
    quantity: int


class PlaceOrderRequest(BaseModel):
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
    number: int
    status: OrderStatus
    dine_in: bool
    payment_method: PaymentMethod
    total_cents: int
    created_at: datetime
    items: list[OrderItemResponse]


@router.post(
    "/orders",
    status_code=201,
    responses={
        409: {"model": ErrorResponse, "description": "a product sold out, or a retry is needed"},
        422: {"model": ErrorResponse, "description": "empty order, bad quantity, unknown product"},
    },
)
def place_order(
    request: PlaceOrderRequest,
    use_case: Annotated[PlaceOrderUseCase, Depends(get_place_order_use_case)],
) -> OrderResponse:
    order = use_case.execute(
        PlaceOrder(
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
    responses={422: {"model": ErrorResponse, "description": "the date is not YYYY-MM-DD"}},
)
def list_orders(
    use_case: Annotated[ListOrdersUseCase, Depends(get_list_orders_use_case)],
    business_date: Annotated[date | None, Query(alias="date")] = None,
) -> list[OrderResponse]:
    """A business day's orders by number: today in São Paulo unless `date` names another."""
    return [_order_response(order) for order in use_case.execute(business_date)]


@router.patch(
    "/orders/{order_id}",
    responses={
        404: {"model": ErrorResponse, "description": "no order has that id"},
        409: {"model": ErrorResponse, "description": "not one step forward or back"},
        422: {"model": ErrorResponse, "description": "unknown status or malformed id"},
    },
)
def change_order_status(
    order_id: uuid.UUID,
    request: ChangeStatusRequest,
    use_case: Annotated[ChangeOrderStatusUseCase, Depends(get_change_order_status_use_case)],
) -> OrderResponse:
    return _order_response(use_case.execute(order_id, request.status))


def _order_response(order: Order) -> OrderResponse:
    return OrderResponse(
        id=order.id,
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
