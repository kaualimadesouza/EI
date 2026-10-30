import uuid
from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest

from topa_api.application.export_order_to_pos import export_order_to_pos
from topa_api.domain.catalog import Store
from topa_api.domain.errors import OrderNotFoundError
from topa_api.domain.fiscal import FiscalDocument, StoreFiscalProfile
from topa_api.domain.orders import Order, OrderItem, OrderStatus, PaymentMethod
from topa_api.domain.pos_integration import PosExportResult, PosMechanismType

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


class DummyPosAdapter:
    def export_order(
        self,
        order: Order,
        store_profile: StoreFiscalProfile,
        fiscal_doc: FiscalDocument | None = None,
    ) -> PosExportResult:
        return PosExportResult(
            adapter_name="DummyAdapter",
            mechanism=PosMechanismType.FILE_DROP,
            success=True,
            destination="dummy://dest",
            timestamp=datetime.now(SP_TZ),
        )


def test_export_order_to_pos_success() -> None:
    order_id = uuid.uuid4()
    order = Order(
        id=order_id,
        store_slug="lanchonete-bem-te-vi",
        number=15,
        business_date=date(2026, 10, 30),
        status=OrderStatus.PREPARING,
        dine_in=True,
        payment_method=PaymentMethod.CARD,
        items=(OrderItem("misto", "Misto Quente", 1, 1200),),
        created_at=datetime(2026, 10, 30, 11, 0, 0, tzinfo=SP_TZ),
    )
    store = Store(slug="lanchonete-bem-te-vi", name="Lanchonete Bem-te-vi")
    order_repo = DummyOrderRepo(order)
    store_repo = DummyStoreRepo(store)
    adapter = DummyPosAdapter()

    res = export_order_to_pos(
        order_id,
        adapter,
        order_repo,  # type: ignore[arg-type]
        store_repo,  # type: ignore[arg-type]
    )
    assert res.success is True
    assert res.adapter_name == "DummyAdapter"


def test_export_order_to_pos_fallback_store() -> None:
    order_id = uuid.uuid4()
    order = Order(
        id=order_id,
        store_slug="desconhecida",
        number=1,
        business_date=date(2026, 10, 30),
        status=OrderStatus.PREPARING,
        dine_in=False,
        payment_method=PaymentMethod.PIX,
        items=(OrderItem("suco", "Suco", 1, 800),),
        created_at=datetime(2026, 10, 30, 11, 0, 0, tzinfo=SP_TZ),
    )
    order_repo = DummyOrderRepo(order)
    store_repo = DummyStoreRepo(None)
    adapter = DummyPosAdapter()

    res = export_order_to_pos(
        order_id,
        adapter,
        order_repo,  # type: ignore[arg-type]
        store_repo,  # type: ignore[arg-type]
    )
    assert res.success is True


def test_export_order_to_pos_not_found() -> None:
    order_repo = DummyOrderRepo(None)
    store_repo = DummyStoreRepo(None)
    adapter = DummyPosAdapter()
    with pytest.raises(OrderNotFoundError):
        export_order_to_pos(
            uuid.uuid4(),
            adapter,
            order_repo,  # type: ignore[arg-type]
            store_repo,  # type: ignore[arg-type]
        )
