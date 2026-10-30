import uuid
from datetime import UTC, datetime

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from topa_api.adapters.db.repositories import SqlAlchemyCustomerRepository
from topa_api.domain.auth import Customer


def test_adds_and_retrieves_customer_by_email_and_id(db_engine: Engine) -> None:
    customer_id = uuid.uuid4()
    customer = Customer(
        id=customer_id,
        name="Paula Tejando",
        email="paula@exemplo.com",
        created_at=datetime(2026, 10, 30, 10, 0, tzinfo=UTC),
    )

    with Session(db_engine) as session, session.begin():
        repo = SqlAlchemyCustomerRepository(session)
        repo.add(customer, "hashed_secret_password")

    with Session(db_engine) as session:
        repo = SqlAlchemyCustomerRepository(session)
        record = repo.get_by_email("  PAULA@EXEMPLO.COM  ")
        assert record is not None
        assert record.customer.id == customer_id
        assert record.customer.name == "Paula Tejando"
        assert record.customer.email == "paula@exemplo.com"
        assert record.password_hash == "hashed_secret_password"

        by_id = repo.get_by_id(customer_id)
        assert by_id is not None
        assert by_id.customer.id == customer_id


def test_customer_repository_returns_none_when_not_found(db_engine: Engine) -> None:
    with Session(db_engine) as session:
        repo = SqlAlchemyCustomerRepository(session)
        assert repo.get_by_email("nonexistent@exemplo.com") is None
        assert repo.get_by_id(uuid.uuid4()) is None
