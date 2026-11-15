import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from topa_api.adapters.db.repositories import (
    SqlAlchemyMerchantRepository,
    SqlAlchemyStoreRepository,
)
from topa_api.domain.auth import Merchant
from topa_api.domain.errors import EmailAlreadyInUseError


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


def test_duplicate_email_race_is_a_domain_conflict_not_a_server_error(db_engine: Engine) -> None:
    merchant = Merchant(
        uuid.uuid4(), "admin@bemtevi.topa.com", "lanchonete-bem-te-vi", datetime.now(UTC)
    )
    with Session(db_engine) as session, session.begin(), session.begin_nested():
        with pytest.raises(EmailAlreadyInUseError):
            SqlAlchemyMerchantRepository(session).add(merchant, "hashed_password")
        session.rollback()


def test_store_deleted_before_ordering_change_does_not_report_success(db_engine: Engine) -> None:
    with Session(db_engine) as session:
        assert SqlAlchemyStoreRepository(session).set_accepting_orders("unknown", False) is None


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
