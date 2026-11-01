import uuid
from datetime import UTC, date, datetime

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from topa_api.adapters.db.models import OrderRow, StoreRow
from topa_api.adapters.db.repositories import SqlAlchemyPaymentRepository
from topa_api.domain.payment import PaymentStatus, PixCharge


def _seed_store_and_order(session: Session) -> uuid.UUID:
    order_id = uuid.uuid4()
    if session.get(StoreRow, "lanchonete-bem-te-vi") is None:
        session.add(StoreRow(slug="lanchonete-bem-te-vi", name="Lanchonete Bem-te-vi"))
    session.add(
        OrderRow(
            id=order_id,
            store_slug="lanchonete-bem-te-vi",
            business_date=date(2026, 11, 1),
            number=1,
            status="received",
            dine_in=True,
            payment_method="pix",
            total_cents=2500,
            created_at=datetime.now(UTC),
        )
    )
    session.flush()
    return order_id


def test_payment_repository_save_get_and_update(db_engine: Engine) -> None:
    with Session(db_engine) as session, session.begin():
        order_id = _seed_store_and_order(session)
        repo = SqlAlchemyPaymentRepository(session)

        charge = PixCharge(
            id="pix_charge_1001",
            order_id=order_id,
            amount_cents=2500,
            status=PaymentStatus.PENDING,
            br_code="000201...",
            br_code_base64=None,
            qr_code_url="https://pay.abacatepay.com/bill-1001",
            expires_at=datetime(2026, 11, 1, 16, 0, tzinfo=UTC),
            created_at=datetime(2026, 11, 1, 15, 0, tzinfo=UTC),
        )

        repo.save_payment(charge)

    with Session(db_engine) as session, session.begin():
        repo = SqlAlchemyPaymentRepository(session)
        retrieved = repo.get_payment("pix_charge_1001")
        assert retrieved is not None
        assert retrieved.id == "pix_charge_1001"
        assert retrieved.order_id == order_id
        assert retrieved.amount_cents == 2500
        assert retrieved.status == PaymentStatus.PENDING
        assert retrieved.br_code == "000201..."

        by_order = repo.get_payment_by_order_id(order_id)
        assert by_order is not None
        assert by_order.id == "pix_charge_1001"

        repo.update_payment_status("pix_charge_1001", PaymentStatus.PAID)

    with Session(db_engine) as session:
        repo = SqlAlchemyPaymentRepository(session)
        updated = repo.get_payment("pix_charge_1001")
        assert updated is not None
        assert updated.status == PaymentStatus.PAID


def test_payment_repository_not_found_returns_none(db_engine: Engine) -> None:
    with Session(db_engine) as session, session.begin():
        repo = SqlAlchemyPaymentRepository(session)
        assert repo.get_payment("non-existent") is None
        assert repo.get_payment_by_order_id(uuid.uuid4()) is None
        # Updating non-existent payment is a no-op
        repo.update_payment_status("non-existent", PaymentStatus.PAID)
