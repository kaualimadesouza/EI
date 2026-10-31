import base64
import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from topa_api.application.change_order_status import ChangeOrderStatusUseCase
from topa_api.application.check_order_rate_limit import CheckOrderRateLimitUseCase
from topa_api.application.export_order_to_pos import export_order_to_pos
from topa_api.application.generate_order_fiscal import generate_order_fiscal
from topa_api.application.list_customer_orders import ListCustomerOrdersUseCase
from topa_api.application.list_orders import ListOrdersUseCase
from topa_api.application.place_order import PlaceOrder, PlaceOrderUseCase
from topa_api.application.ports import OrderRepository, StoreRepository
from topa_api.application.read_order import ReadOrderUseCase
from topa_api.application.render_order_print import PrintReceiptType, render_order_print
from topa_api.domain.auth import AuthenticatedCustomer, AuthenticatedMerchant
from topa_api.domain.catalog import DEFAULT_STORE_SLUG
from topa_api.domain.errors import ForbiddenStoreAccessError, InvalidIdempotencyKeyError
from topa_api.domain.fiscal import FiscalStandard
from topa_api.domain.orders import Order, OrderLine, OrderStatus, PaymentMethod
from topa_api.domain.pos_integration import PosAdapterPort
from topa_api.presentation.fastapi.dependencies import (
    StoreSlug,
    get_change_order_status_use_case,
    get_check_order_rate_limit_use_case,
    get_current_customer,
    get_current_merchant,
    get_list_customer_orders_use_case,
    get_list_orders_use_case,
    get_optional_customer,
    get_order_repository,
    get_place_order_use_case,
    get_pos_adapter,
    get_read_order_use_case,
    get_store_repository,
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
    client_order_id: uuid.UUID | None = None


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
    client_order_id: uuid.UUID | None = None


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
    customer: Annotated[AuthenticatedCustomer | None, Depends(get_optional_customer)] = None,
) -> OrderResponse:
    rate_limit.execute(_client_ip(request_obj))
    client_order_id = request.client_order_id
    if client_order_id is None:
        raw_header = request_obj.headers.get("x-idempotency-key") or request_obj.headers.get(
            "idempotency-key"
        )
        if raw_header:
            try:
                client_order_id = uuid.UUID(raw_header)
            except ValueError as err:
                raise InvalidIdempotencyKeyError from err
    order = use_case.execute(
        PlaceOrder(
            store_slug=request.store_slug,
            lines=tuple(
                OrderLine(product_id=item.product_id, quantity=item.quantity)
                for item in request.items
            ),
            dine_in=request.dine_in,
            payment_method=request.payment_method,
            customer_id=customer.id if customer is not None else None,
            client_order_id=client_order_id,
        )
    )
    return _order_response(order)


@router.get(
    "/orders/me",
    responses={
        401: {"model": ErrorResponse, "description": "missing or invalid customer auth token"},
    },
)
def list_customer_orders(
    use_case: Annotated[ListCustomerOrdersUseCase, Depends(get_list_customer_orders_use_case)],
    customer: Annotated[AuthenticatedCustomer, Depends(get_current_customer)],
) -> list[OrderResponse]:
    """Returns all orders placed by the authenticated customer."""
    orders = use_case.execute(customer.id)
    return [_order_response(order) for order in orders]


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
        client_order_id=order.client_order_id,
    )


class FiscalItemResponse(BaseModel):
    product_id: str
    name: str
    quantity: int
    unit_price_cents: int
    total_price_cents: int
    ncm: str
    cfop: str
    csosn: str
    approx_tax_cents: int


class FiscalDocumentResponse(BaseModel):
    access_key: str
    formatted_access_key: str
    standard: str
    environment: int
    series: int
    number: int
    issued_at: datetime
    subtotal_cents: int
    total_cents: int
    approx_tax_cents: int
    payment_method: PaymentMethod
    qr_code_url: str
    digest_value: str
    xml_payload: str
    items: list[FiscalItemResponse]


class EmulatorLineResponse(BaseModel):
    text: str
    align: str
    bold: bool
    double_size: bool
    is_cut: bool


class PrintReceiptResponse(BaseModel):
    receipt_type: str
    plain_text: str
    preview_lines: list[EmulatorLineResponse]
    raw_bytes_base64: str


class PosExportItemResponse(BaseModel):
    adapter_name: str
    mechanism: str
    success: bool
    destination: str
    timestamp: datetime
    error_message: str | None = None


@router.get(
    "/orders/{order_id}/fiscal",
    responses={
        404: {"model": ErrorResponse, "description": "no order has that id"},
    },
)
def get_order_fiscal(
    order_id: uuid.UUID,
    orders: Annotated[OrderRepository, Depends(get_order_repository)],
    stores: Annotated[StoreRepository, Depends(get_store_repository)],
    standard: FiscalStandard = FiscalStandard.NFCE,
) -> FiscalDocumentResponse:
    doc = generate_order_fiscal(order_id, orders, stores, standard=standard)
    return FiscalDocumentResponse(
        access_key=doc.access_key,
        formatted_access_key=doc.formatted_access_key,
        standard=doc.standard.value,
        environment=int(doc.environment),
        series=doc.series,
        number=doc.number,
        issued_at=doc.issued_at,
        subtotal_cents=doc.subtotal_cents,
        total_cents=doc.total_cents,
        approx_tax_cents=doc.approx_tax_cents,
        payment_method=doc.payment_method,
        qr_code_url=doc.qr_code_url,
        digest_value=doc.digest_value,
        xml_payload=doc.xml_payload,
        items=[
            FiscalItemResponse(
                product_id=it.product_id,
                name=it.name,
                quantity=it.quantity,
                unit_price_cents=it.unit_price_cents,
                total_price_cents=it.total_price_cents,
                ncm=it.ncm,
                cfop=it.cfop,
                csosn=it.csosn,
                approx_tax_cents=it.approx_tax_cents,
            )
            for it in doc.items
        ],
    )


@router.get(
    "/orders/{order_id}/print/{receipt_type}",
    responses={
        404: {"model": ErrorResponse, "description": "no order has that id"},
    },
)
def get_order_print(
    order_id: uuid.UUID,
    receipt_type: PrintReceiptType,
    orders: Annotated[OrderRepository, Depends(get_order_repository)],
    stores: Annotated[StoreRepository, Depends(get_store_repository)],
) -> PrintReceiptResponse:
    res = render_order_print(order_id, receipt_type, orders, stores)
    return PrintReceiptResponse(
        receipt_type=res.receipt_type.value,
        plain_text=res.plain_text,
        preview_lines=[
            EmulatorLineResponse(
                text=line.text,
                align=line.align,
                bold=line.bold,
                double_size=line.double_size,
                is_cut=line.is_cut,
            )
            for line in res.preview_lines
        ],
        raw_bytes_base64=base64.b64encode(res.raw_bytes).decode("ascii"),
    )


@router.post(
    "/orders/{order_id}/pos-export",
    responses={
        404: {"model": ErrorResponse, "description": "no order has that id"},
    },
)
def export_order_pos(
    order_id: uuid.UUID,
    orders: Annotated[OrderRepository, Depends(get_order_repository)],
    stores: Annotated[StoreRepository, Depends(get_store_repository)],
    pos_adapter: Annotated[PosAdapterPort, Depends(get_pos_adapter)],
) -> PosExportItemResponse:
    res = export_order_to_pos(order_id, pos_adapter, orders, stores)
    return PosExportItemResponse(
        adapter_name=res.adapter_name,
        mechanism=res.mechanism.value,
        success=res.success,
        destination=res.destination,
        timestamp=res.timestamp,
        error_message=res.error_message,
    )
