import uuid
from dataclasses import dataclass
from enum import StrEnum

from topa_api.application.ports import OrderRepository, StoreRepository
from topa_api.domain.errors import OrderNotFoundError
from topa_api.domain.escpos import (
    EmulatorLine,
    EscPosEmulator,
    render_customer_receipt,
    render_kitchen_ticket,
)
from topa_api.domain.fiscal import (
    build_fiscal_document,
    get_store_fiscal_profile,
)


class PrintReceiptType(StrEnum):
    KITCHEN = "kitchen"
    CUSTOMER = "customer"


@dataclass(frozen=True)
class RenderedPrintResult:
    receipt_type: PrintReceiptType
    raw_bytes: bytes
    preview_lines: list[EmulatorLine]
    plain_text: str


def render_order_print(
    order_id: uuid.UUID,
    receipt_type: PrintReceiptType,
    order_repo: OrderRepository,
    store_repo: StoreRepository,
) -> RenderedPrintResult:
    order = order_repo.get(order_id)
    if order is None:
        raise OrderNotFoundError()
    store = store_repo.get(order.store_slug)
    store_name = store.name if store else order.store_slug
    profile = get_store_fiscal_profile(order.store_slug, store_name=store_name)

    if receipt_type == PrintReceiptType.KITCHEN:
        raw_bytes = render_kitchen_ticket(order, store_name)
    else:
        fiscal_doc = build_fiscal_document(order, profile)
        raw_bytes = render_customer_receipt(order, profile, fiscal_doc)

    preview_lines = EscPosEmulator.decode(raw_bytes)
    plain_text = EscPosEmulator.to_text(raw_bytes)
    return RenderedPrintResult(
        receipt_type=receipt_type,
        raw_bytes=raw_bytes,
        preview_lines=preview_lines,
        plain_text=plain_text,
    )
