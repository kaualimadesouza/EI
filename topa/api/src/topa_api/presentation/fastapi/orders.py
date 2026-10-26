import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from topa_api.application.place_order import PlaceOrder, PlaceOrderUseCase
from topa_api.domain.orders import OrderLine, OrderStatus, PaymentMethod
from topa_api.presentation.fastapi.dependencies import get_place_order_use_case
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
