import uuid
from datetime import UTC, datetime

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from topa_api.adapters.db.repositories import SqlAlchemyMerchantRepository
from topa_api.domain.auth import Merchant


def test_retrieves_seeded_default_merchant_by_email(db_engine: Engine) -> None:
    with Session(db_engine) as session:
        repo = SqlAlchemyMerchantRepository(session)
        record = repo.get_by_email("admin@bemtevi.topa.com")

        assert record is not None
        assert record.merchant.email == "admin@bemtevi.topa.com"
        assert record.merchant.store_slug == "lanchonete-bem-te-vi"
        assert record.password_hash.startswith("scrypt$")


def test_normalizes_email_case_and_whitespace(db_engine: Engine) -> None:
    with Session(db_engine) as session:
        repo = SqlAlchemyMerchantRepository(session)
        record = repo.get_by_email("  ADMIN@BEMTEVI.TOPA.COM  ")

        assert record is not None
        assert record.merchant.email == "admin@bemtevi.topa.com"


def test_returns_none_for_unknown_merchant_email(db_engine: Engine) -> None:
    with Session(db_engine) as session:
        repo = SqlAlchemyMerchantRepository(session)

        assert repo.get_by_email("unknown@bemtevi.topa.com") is None


def test_adds_and_retrieves_new_merchant(db_engine: Engine) -> None:
    merchant_id = uuid.uuid4()
    merchant = Merchant(
        id=merchant_id,
        email="gerente@bemtevi.topa.com",
        store_slug="lanchonete-bem-te-vi",
        created_at=datetime(2026, 10, 29, 14, 30, tzinfo=UTC),
    )

    with Session(db_engine) as session, session.begin():
        repo = SqlAlchemyMerchantRepository(session)
        repo.add(merchant, "hashed_gerente_password")

    with Session(db_engine) as session:
        repo = SqlAlchemyMerchantRepository(session)
        record = repo.get_by_email("gerente@bemtevi.topa.com")
        assert record is not None
        assert record.merchant.id == merchant_id
        assert record.merchant.email == "gerente@bemtevi.topa.com"
        assert record.password_hash == "hashed_gerente_password"
