import logging
import uuid
from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime, timedelta
from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, insert, select
from sqlalchemy.orm import Session

from tests.fakes import FixedClock
from topa_api.adapters.db.models import OrderItemRow, OrderRow, ProductRow, StoreRow
from topa_api.adapters.db.session import get_engine
from topa_api.adapters.security.token_service import HmacTokenService
from topa_api.domain.auth import AuthenticatedMerchant
from topa_api.entrypoints.rest_application import create_app, get_session
from topa_api.settings import Settings

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
        "store_slug": "lanchonete-bem-te-vi",
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


def test_the_days_orders_are_listed_by_number_as_they_were_placed(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    first = client.post(
        "/orders", json=_order(("xsalada", 2), ("refri", 1), dine_in=False, payment_method="card")
    ).json()
    second = client.post("/orders", json=_order(("cafe", 1))).json()

    response = client.get("/orders", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == [first, second]


def test_listed_items_follow_the_menu_order(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    """The kitchen reads lanches before bebidas, whatever order the customer tapped them in."""
    client.post("/orders", json=_order(("refri", 1), ("cafe", 1), ("xsalada", 1)))

    items = client.get("/orders", headers=auth_headers).json()[0]["items"]

    assert [item["product_id"] for item in items] == ["xsalada", "cafe", "refri"]


def test_another_days_orders_are_listed_when_asked_for(
    client: TestClient, clock: FixedClock, auth_headers: dict[str, str]
) -> None:
    monday = client.post("/orders", json=_order(("cafe", 1))).json()
    clock.moment += timedelta(days=1)
    tuesday = client.post("/orders", json=_order(("agua", 1))).json()

    assert client.get("/orders", params={"date": "2026-10-26"}, headers=auth_headers).json() == [
        monday
    ]
    assert client.get("/orders", headers=auth_headers).json() == [tuesday]


def test_a_day_without_orders_lists_nothing(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    client.post("/orders", json=_order(("cafe", 1)))

    response = client.get("/orders", params={"date": "2026-01-01"}, headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.parametrize("day", ["26/10/2026", "2026-02-30", "ontem"])
def test_a_malformed_date_gets_the_generic_message(
    client: TestClient, day: str, auth_headers: dict[str, str]
) -> None:
    response = client.get("/orders", params={"date": day}, headers=auth_headers)

    assert response.status_code == 422
    assert response.json() == {"detail": INVALID_REQUEST}


def test_moving_an_order_returns_it_with_the_new_status(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    placed = client.post("/orders", json=_order(("xsalada", 1), ("refri", 2))).json()

    response = client.patch(
        f"/orders/{placed['id']}", json={"status": "preparing"}, headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json() == {**placed, "status": "preparing"}
    assert client.get("/orders", headers=auth_headers).json() == [{**placed, "status": "preparing"}]


def test_an_order_walks_to_delivered_and_back_one_step_at_a_time(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    order_id = client.post("/orders", json=_order(("cafe", 1))).json()["id"]
    steps = ["preparing", "ready", "delivered", "ready", "preparing", "received"]

    responses = [
        client.patch(f"/orders/{order_id}", json={"status": step}, headers=auth_headers)
        for step in steps
    ]

    assert [(response.status_code, response.json()["status"]) for response in responses] == [
        (200, step) for step in steps
    ]


def test_skipping_a_step_is_refused_and_the_order_stays_put(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    placed = client.post("/orders", json=_order(("cafe", 1))).json()

    response = client.patch(
        f"/orders/{placed['id']}", json={"status": "delivered"}, headers=auth_headers
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "O pedido 001 não pode passar de recebido para entregue."}
    assert client.get("/orders", headers=auth_headers).json() == [placed]


def test_one_order_is_read_as_it_stands_now(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    placed = client.post("/orders", json=_order(("xsalada", 1), ("refri", 2))).json()
    client.patch(f"/orders/{placed['id']}", json={"status": "preparing"}, headers=auth_headers)

    response = client.get(f"/orders/{placed['id']}")

    assert response.status_code == 200
    assert response.json() == {**placed, "status": "preparing"}


def test_reading_an_unknown_order_is_not_found(client: TestClient) -> None:
    response = client.get(f"/orders/{uuid.uuid4()}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Pedido não encontrado."}


def test_reading_an_order_by_a_malformed_id_gets_the_generic_message(client: TestClient) -> None:
    response = client.get("/orders/47")

    assert response.status_code == 422
    assert response.json() == {"detail": INVALID_REQUEST}


def test_moving_an_unknown_order_is_not_found(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client.patch(
        f"/orders/{uuid.uuid4()}", json={"status": "preparing"}, headers=auth_headers
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Pedido não encontrado."}


@pytest.mark.parametrize(
    ("order_id", "payload"),
    [
        (str(uuid.uuid4()), {"status": "cancelled"}),
        (str(uuid.uuid4()), {"status": "recebido"}),
        (str(uuid.uuid4()), {}),
        ("47", {"status": "preparing"}),
    ],
    ids=["unknown-status", "label-instead-of-value", "no-status", "id-not-a-uuid"],
)
def test_a_malformed_status_change_gets_the_generic_message(
    client: TestClient,
    caplog: pytest.LogCaptureFixture,
    order_id: str,
    payload: dict[str, str],
    auth_headers: dict[str, str],
) -> None:
    with caplog.at_level(logging.WARNING):
        response = client.patch(f"/orders/{order_id}", json=payload, headers=auth_headers)

    assert response.status_code == 422
    assert response.json() == {"detail": INVALID_REQUEST}
    assert f"invalid request to /orders/{order_id}" in caplog.text


def test_orders_and_daily_numbers_are_isolated_per_store(
    client: TestClient, db_engine: Engine, auth_headers: dict[str, str]
) -> None:
    with db_engine.begin() as connection:
        connection.execute(insert(StoreRow).values(slug="cantina-central", name="Cantina Central"))
        connection.execute(
            insert(ProductRow).values(
                store_slug="cantina-central",
                id="cafe",
                position=1,
                name="Café expresso",
                description="50 ml.",
                category="bebidas",
                price_cents=700,
                available=True,
            )
        )

    bem_te_vi = client.post("/orders", json=_order(("cafe", 1))).json()
    cantina = client.post(
        "/orders", json={**_order(("cafe", 1)), "store_slug": "cantina-central"}
    ).json()

    assert (bem_te_vi["store_slug"], bem_te_vi["number"], bem_te_vi["total_cents"]) == (
        "lanchonete-bem-te-vi",
        1,
        550,
    )
    assert (cantina["store_slug"], cantina["number"], cantina["total_cents"]) == (
        "cantina-central",
        1,
        700,
    )
    cantina_token = HmacTokenService(Settings().auth_secret_key).create_token(
        AuthenticatedMerchant(
            id=uuid.uuid4(), email="cantina@topa.com", store_slug="cantina-central"
        )
    )
    assert client.get("/orders", headers=auth_headers).json() == [bem_te_vi]
    assert client.get(
        "/orders",
        params={"loja": "cantina-central"},
        headers={"Authorization": f"Bearer {cantina_token}"},
    ).json() == [cantina]


def test_placing_or_listing_orders_for_an_unknown_store_is_not_found(
    client: TestClient,
) -> None:
    placed = client.post(
        "/orders", json={**_order(("cafe", 1)), "store_slug": "padaria-inexistente"}
    )
    token = HmacTokenService(Settings().auth_secret_key).create_token(
        AuthenticatedMerchant(
            id=uuid.uuid4(), email="padaria@topa.com", store_slug="padaria-inexistente"
        )
    )
    listed = client.get(
        "/orders",
        params={"loja": "padaria-inexistente"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert (placed.status_code, placed.json()) == (404, {"detail": "Loja não encontrada."})
    assert (listed.status_code, listed.json()) == (404, {"detail": "Loja não encontrada."})


def test_a_malformed_store_slug_on_orders_gets_the_generic_message(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    placed = client.post("/orders", json={**_order(("cafe", 1)), "store_slug": "Cantina"})
    listed = client.get("/orders", params={"loja": "Cantina"}, headers=auth_headers)

    assert (placed.status_code, placed.json()) == (422, {"detail": INVALID_REQUEST})
    assert (listed.status_code, listed.json()) == (422, {"detail": INVALID_REQUEST})
