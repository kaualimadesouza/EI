import uuid
from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest

from topa_api.application.render_order_print import PrintReceiptType, render_order_print
from topa_api.domain.catalog import Store
from topa_api.domain.errors import OrderNotFoundError
from topa_api.domain.orders import Order, OrderItem, OrderStatus, PaymentMethod

SP_TZ = ZoneInfo("America/Sao_Paulo")


class DummyOrderRepo:
    def __init__(self, order: Order | None) -> None:
        self.order = order

    def get(self, order_id: uuid.UUID) -> Order | None:
        if self.order and self.order.id == order_id:
            return self.order
        return None


class DummyStoreRepo:
    def __init__(self, store: Store | None) -> None:
        self.store = store

    def get(self, slug: str) -> Store | None:
        if self.store and self.store.slug == slug:
            return self.store
        return None


def test_render_order_print_kitchen_and_customer() -> None:
    order_id = uuid.uuid4()
    order = Order(
        id=order_id,
        store_slug="lanchonete-bem-te-vi",
        number=10,
        business_date=date(2026, 10, 30),
        status=OrderStatus.RECEIVED,
        dine_in=True,
        payment_method=PaymentMethod.CARD,
        items=(OrderItem("misto", "Misto Quente", 2, 1200),),
        created_at=datetime(2026, 10, 30, 11, 0, 0, tzinfo=SP_TZ),
    )
    store = Store(slug="lanchonete-bem-te-vi", name="Lanchonete Bem-te-vi")
    order_repo = DummyOrderRepo(order)
    store_repo = DummyStoreRepo(store)

    # Kitchen print
    res_k = render_order_print(
        order_id,
        PrintReceiptType.KITCHEN,
        order_repo,  # type: ignore[arg-type]
        store_repo,  # type: ignore[arg-type]
    )
    assert res_k.receipt_type == PrintReceiptType.KITCHEN
    assert "PEDIDO #10" in res_k.plain_text

    # Customer print
    res_c = render_order_print(
        order_id,
        PrintReceiptType.CUSTOMER,
        order_repo,  # type: ignore[arg-type]
        store_repo,  # type: ignore[arg-type]
    )
    assert res_c.receipt_type == PrintReceiptType.CUSTOMER
    assert "DOCUMENTO AUXILIAR" in res_c.plain_text


def test_render_order_print_fallback_store_name() -> None:
    order_id = uuid.uuid4()
    order = Order(
        id=order_id,
        store_slug="sem-loja",
        number=1,
        business_date=date(2026, 10, 30),
        status=OrderStatus.RECEIVED,
        dine_in=False,
        payment_method=PaymentMethod.PIX,
        items=(OrderItem("item", "Item", 1, 100),),
        created_at=datetime(2026, 10, 30, 11, 0, 0, tzinfo=SP_TZ),
    )
    order_repo = DummyOrderRepo(order)
    store_repo = DummyStoreRepo(None)

    res = render_order_print(
        order_id,
        PrintReceiptType.KITCHEN,
        order_repo,  # type: ignore[arg-type]
        store_repo,  # type: ignore[arg-type]
    )
    assert "SEM-LOJA" in res.plain_text


def test_render_order_print_not_found() -> None:
    order_repo = DummyOrderRepo(None)
    store_repo = DummyStoreRepo(None)
    with pytest.raises(OrderNotFoundError):
        render_order_print(
            uuid.uuid4(),
            PrintReceiptType.KITCHEN,
            order_repo,  # type: ignore[arg-type]
            store_repo,  # type: ignore[arg-type]
        )
