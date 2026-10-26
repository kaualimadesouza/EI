import logging
import uuid
from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime, timedelta
from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from tests.fakes import FixedClock, InMemoryOrderRepository
from topa_api.adapters.db.models import OrderItemRow, OrderRow
from topa_api.adapters.db.session import get_engine
from topa_api.entrypoints.rest_application import create_app, get_session
from topa_api.presentation.fastapi.dependencies import get_order_repository

INVALID_REQUEST = "Não foi possível processar a solicitação. Tente de novo."
QUANTITY_OUT_OF_RANGE = "Escolha de 1 a 20 unidades de cada produto."


def _order(
    *items: tuple[str, int], dine_in: bool = True, payment_method: str = "pix"
) -> dict[str, object]:
    return {
        "items": [
            {"product_id": product_id, "quantity": quantity} for product_id, quantity in items
        ],
        "dine_in": dine_in,
        "payment_method": payment_method,
    }


def _stored_orders(db_engine: Engine) -> int:
    with Session(db_engine) as session:
        return session.scalar(select(func.count()).select_from(OrderRow)) or 0


def test_placing_an_order_returns_its_number_and_the_priced_items(client: TestClient) -> None:
    response = client.post(
        "/orders", json=_order(("xsalada", 2), ("refri", 1), dine_in=False, payment_method="card")
    )

    assert response.status_code == 201
    body = response.json()
    assert uuid.UUID(body.pop("id"))
    assert body == {
        "number": 1,
        "status": "received",
        "dine_in": False,
        "payment_method": "card",
        "total_cents": 2 * 2290 + 690,
        "created_at": "2026-10-26T15:00:00Z",
        "items": [
            {"product_id": "xsalada", "name": "X-salada", "quantity": 2, "unit_price_cents": 2290},
            {"product_id": "refri", "name": "Refrigerante", "quantity": 1, "unit_price_cents": 690},
        ],
    }


def test_the_order_is_stored_with_its_business_day_and_items(
    client: TestClient, db_engine: Engine
) -> None:
    order_id = client.post("/orders", json=_order(("cafe", 2), ("bolo", 1))).json()["id"]

    with Session(db_engine) as session:
        row = session.get_one(OrderRow, uuid.UUID(order_id))
        assert (row.business_date, row.number, row.status, row.payment_method) == (
            date(2026, 10, 26),
            1,
            "received",
            "pix",
        )
        assert row.dine_in is True
        assert row.total_cents == 2 * 550 + 850
        assert row.created_at == datetime(2026, 10, 26, 15, 0, tzinfo=UTC)
        items = session.scalars(
            select(OrderItemRow)
            .where(OrderItemRow.order_id == row.id)
            .order_by(OrderItemRow.product_id)
        ).all()
        assert [(item.product_id, item.quantity, item.unit_price_cents) for item in items] == [
            ("bolo", 1, 850),
            ("cafe", 2, 550),
        ]


def test_numbers_count_up_through_the_day_and_restart_the_next(
    client: TestClient, clock: FixedClock
) -> None:
    first = client.post("/orders", json=_order(("cafe", 1))).json()["number"]
    second = client.post("/orders", json=_order(("cafe", 1))).json()["number"]
    clock.moment += timedelta(days=1)
    next_day = client.post("/orders", json=_order(("cafe", 1))).json()["number"]

    assert (first, second, next_day) == (1, 2, 1)


def test_a_late_night_order_continues_that_evenings_numbers(
    client: TestClient, clock: FixedClock
) -> None:
    """23h30 in São Paulo is already tomorrow in UTC, but it is still tonight's shift."""
    client.post("/orders", json=_order(("cafe", 1)))
    clock.moment = datetime(2026, 10, 27, 2, 30, tzinfo=UTC)

    assert client.post("/orders", json=_order(("cafe", 1))).json()["number"] == 2


def test_repeated_products_are_merged_into_one_item(client: TestClient) -> None:
    response = client.post("/orders", json=_order(("xsalada", 1), ("refri", 2), ("xsalada", 2)))

    assert [(item["product_id"], item["quantity"]) for item in response.json()["items"]] == [
        ("xsalada", 3),
        ("refri", 2),
    ]
    assert response.json()["total_cents"] == 3 * 2290 + 2 * 690


def test_prices_sent_by_the_kiosk_are_ignored(client: TestClient) -> None:
    payload = _order(("xsalada", 1))
    payload["total_cents"] = 1
    payload["items"] = [{"product_id": "xsalada", "quantity": 1, "unit_price_cents": 1}]

    body = client.post("/orders", json=payload).json()

    assert body["items"][0]["unit_price_cents"] == 2290
    assert body["total_cents"] == 2290


@pytest.mark.parametrize(
    ("payload", "detail"),
    [
        (_order(), "Adicione pelo menos um produto ao pedido."),
        (_order(("cafe", 0)), QUANTITY_OUT_OF_RANGE),
        (_order(("cafe", 21)), QUANTITY_OUT_OF_RANGE),
        (_order(("cafe", 15), ("cafe", 6)), QUANTITY_OUT_OF_RANGE),
        (_order(("cafe", 1), ("pastel", 1)), "Um dos produtos não está mais no cardápio."),
    ],
    ids=["no-items", "zero", "over-the-cap", "merged-over-the-cap", "unknown-product"],
)
def test_an_order_that_breaks_a_rule_is_refused_with_the_reason(
    client: TestClient, db_engine: Engine, payload: dict[str, object], detail: str
) -> None:
    response = client.post("/orders", json=payload)

    assert response.status_code == 422
    assert response.json() == {"detail": detail}
    assert _stored_orders(db_engine) == 0


def test_a_sold_out_product_is_refused_by_name(
    client: TestClient, db_engine: Engine, sell_out: Callable[[str], None]
) -> None:
    sell_out("coxinha")

    response = client.post("/orders", json=_order(("cafe", 1), ("coxinha", 2)))

    assert response.status_code == 409
    assert response.json() == {"detail": "Coxinha esgotou."}
    assert _stored_orders(db_engine) == 0


@pytest.mark.parametrize(
    "payload",
    [
        _order(("cafe", 1), payment_method="cash"),
        {"items": [{"product_id": "cafe", "quantity": 1}], "payment_method": "pix"},
        _order(("cafe", "dois")),  # type: ignore[arg-type]
        {"items": "cafe", "dine_in": True, "payment_method": "pix"},
    ],
    ids=["unknown-payment-method", "missing-dine-in", "quantity-not-a-number", "items-not-a-list"],
)
def test_a_malformed_body_gets_a_generic_message_and_the_cause_is_logged(
    client: TestClient, caplog: pytest.LogCaptureFixture, payload: dict[str, object]
) -> None:
    """Only a kiosk bug sends these: the customer gets something readable, the log the cause."""
    with caplog.at_level(logging.WARNING):
        response = client.post("/orders", json=payload)

    assert response.status_code == 422
    assert response.json() == {"detail": INVALID_REQUEST}
    assert "invalid request to /orders" in caplog.text


def test_a_body_that_is_not_json_gets_the_generic_message(client: TestClient) -> None:
    response = client.post(
        "/orders", content=b"{not json", headers={"content-type": "application/json"}
    )

    assert response.status_code == 422
    assert response.json() == {"detail": INVALID_REQUEST}


def test_losing_the_number_race_twice_asks_the_customer_to_try_again(
    app: FastAPI, client: TestClient
) -> None:
    app.dependency_overrides[get_order_repository] = lambda: InMemoryOrderRepository(collisions=2)

    response = client.post("/orders", json=_order(("cafe", 1)))

    assert response.status_code == 409
    assert response.json() == {"detail": "Não foi possível registrar o pedido. Tente de novo."}


def test_without_an_injected_clock_orders_carry_the_server_time(db_engine: Engine) -> None:
    before = datetime.now(tz=UTC)
    with TestClient(create_app()) as client:
        response = client.post("/orders", json=_order(("agua", 1)))
    after = datetime.now(tz=UTC)

    assert response.status_code == 201
    assert before <= datetime.fromisoformat(response.json()["created_at"]) <= after


def test_an_order_whose_commit_fails_is_never_confirmed(app: FastAPI, db_engine: Engine) -> None:
    """The customer must not leave with a number for an order that was never saved."""

    def session_that_cannot_commit(
        engine: Annotated[Engine, Depends(get_engine)],
    ) -> Iterator[Session]:
        with Session(engine) as session:
            yield session
            session.rollback()
            raise ConnectionError("the database went away before COMMIT")

    app.dependency_overrides[get_session] = session_that_cannot_commit
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.post("/orders", json=_order(("cafe", 1)))

    assert response.status_code == 500
    assert _stored_orders(db_engine) == 0
