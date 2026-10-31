import uuid
from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest

from topa_api.application.generate_order_fiscal import generate_order_fiscal
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

    def list_all(self) -> list[Store]:
        return [self.store] if self.store else []


def test_generate_order_fiscal_success() -> None:
    order_id = uuid.uuid4()
    order = Order(
        id=order_id,
        store_slug="lanchonete-bem-te-vi",
        number=1,
        business_date=date(2026, 10, 30),
        status=OrderStatus.RECEIVED,
        dine_in=True,
        payment_method=PaymentMethod.CARD,
        items=(OrderItem("misto", "Misto Quente", 1, 1200),),
        created_at=datetime(2026, 10, 30, 10, 0, 0, tzinfo=SP_TZ),
    )
    store = Store(slug="lanchonete-bem-te-vi", name="Lanchonete Bem-te-vi")
    order_repo = DummyOrderRepo(order)
    store_repo = DummyStoreRepo(store)

    doc = generate_order_fiscal(order_id, order_repo, store_repo)  # type: ignore[arg-type]
    assert doc.number == 1
    assert doc.store_profile.corporate_name == "Lanchonete Bem-te-vi Ltda"


def test_generate_order_fiscal_store_absent_fallback() -> None:
    order_id = uuid.uuid4()
    order = Order(
        id=order_id,
        store_slug="loja-desconhecida",
        number=2,
        business_date=date(2026, 10, 30),
        status=OrderStatus.RECEIVED,
        dine_in=False,
        payment_method=PaymentMethod.PIX,
        items=(OrderItem("suco", "Suco", 1, 800),),
        created_at=datetime(2026, 10, 30, 10, 0, 0, tzinfo=SP_TZ),
    )
    order_repo = DummyOrderRepo(order)
    store_repo = DummyStoreRepo(None)

    doc = generate_order_fiscal(order_id, order_repo, store_repo)  # type: ignore[arg-type]
    assert doc.store_profile.trade_name == "Loja Desconhecida"


def test_generate_order_fiscal_not_found() -> None:
    order_repo = DummyOrderRepo(None)
    store_repo = DummyStoreRepo(None)
    with pytest.raises(OrderNotFoundError):
        generate_order_fiscal(uuid.uuid4(), order_repo, store_repo)  # type: ignore[arg-type]
