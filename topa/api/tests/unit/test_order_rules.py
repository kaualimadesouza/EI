"""The pure order rules (domain/orders.py): lines, prices and the business day."""

import uuid
from dataclasses import replace
from datetime import UTC, date, datetime

import pytest

from topa_api.domain.catalog import Category, Product
from topa_api.domain.errors import (
    EmptyOrderError,
    ProductUnavailableError,
    QuantityOutOfRangeError,
    StatusChangeNotAllowedError,
    UnknownProductError,
)
from topa_api.domain.orders import (
    MAX_QUANTITY,
    STATUS_LABELS,
    Order,
    OrderItem,
    OrderLine,
    OrderStatus,
    PaymentMethod,
    business_date_of,
    merge_lines,
    price_lines,
)

XSALADA = Product(
    id="xsalada",
    name="X-salada",
    description="Hambúrguer, queijo, alface e tomate.",
    category=Category.LANCHES,
    price_cents=2290,
    available=True,
)
REFRI = Product(
    id="refri",
    name="Refrigerante",
    description="Copo de 350 ml com gelo.",
    category=Category.BEBIDAS,
    price_cents=690,
    available=True,
)
SOLD_OUT_COXINHA = Product(
    id="coxinha",
    name="Coxinha",
    description="Frango com catupiry.",
    category=Category.SALGADOS,
    price_cents=890,
    available=False,
)


class TestOrderLine:
    @pytest.mark.parametrize("quantity", [1, MAX_QUANTITY])
    def test_accepts_quantities_from_one_to_the_cap(self, quantity: int) -> None:
        assert OrderLine(product_id="xsalada", quantity=quantity).quantity == quantity

    @pytest.mark.parametrize("quantity", [0, -1, MAX_QUANTITY + 1])
    def test_refuses_a_quantity_outside_the_range(self, quantity: int) -> None:
        with pytest.raises(QuantityOutOfRangeError) as raised:
            OrderLine(product_id="xsalada", quantity=quantity)

        assert str(raised.value) == "Escolha de 1 a 20 unidades de cada produto."


class TestMergeLines:
    def test_sums_repeated_products_in_the_order_they_first_appeared(self) -> None:
        merged = merge_lines(
            [
                OrderLine(product_id="xsalada", quantity=1),
                OrderLine(product_id="refri", quantity=2),
                OrderLine(product_id="xsalada", quantity=2),
            ]
        )

        assert merged == (
            OrderLine(product_id="xsalada", quantity=3),
            OrderLine(product_id="refri", quantity=2),
        )

    def test_keeps_distinct_lines_as_they_are(self) -> None:
        lines = (
            OrderLine(product_id="refri", quantity=1),
            OrderLine(product_id="agua", quantity=4),
        )

        assert merge_lines(lines) == lines

    def test_refuses_an_order_without_lines(self) -> None:
        with pytest.raises(EmptyOrderError) as raised:
            merge_lines([])

        assert str(raised.value) == "Adicione pelo menos um produto ao pedido."

    def test_applies_the_cap_to_the_merged_quantity(self) -> None:
        """Two lines of 15 are each fine, but they are one product with 30 units."""
        with pytest.raises(QuantityOutOfRangeError):
            merge_lines(
                [
                    OrderLine(product_id="xsalada", quantity=15),
                    OrderLine(product_id="xsalada", quantity=15),
                ]
            )


class TestPriceLines:
    def test_takes_name_and_price_from_the_catalog(self) -> None:
        items = price_lines(
            [
                OrderLine(product_id="xsalada", quantity=2),
                OrderLine(product_id="refri", quantity=1),
            ],
            [REFRI, XSALADA],
        )

        assert items == (
            OrderItem(product_id="xsalada", name="X-salada", quantity=2, unit_price_cents=2290),
            OrderItem(product_id="refri", name="Refrigerante", quantity=1, unit_price_cents=690),
        )

    def test_refuses_a_product_missing_from_the_catalog(self) -> None:
        with pytest.raises(UnknownProductError) as raised:
            price_lines([OrderLine(product_id="pastel", quantity=1)], [XSALADA])

        assert raised.value.product_id == "pastel"
        assert str(raised.value) == "Um dos produtos não está mais no cardápio."

    def test_refuses_a_sold_out_product_by_its_name(self) -> None:
        with pytest.raises(ProductUnavailableError) as raised:
            price_lines(
                [
                    OrderLine(product_id="xsalada", quantity=1),
                    OrderLine(product_id="coxinha", quantity=1),
                ],
                [XSALADA, SOLD_OUT_COXINHA],
            )

        assert str(raised.value) == "Coxinha esgotou."


class TestBusinessDate:
    def test_is_the_sao_paulo_calendar_day(self) -> None:
        assert business_date_of(datetime(2026, 10, 26, 15, 0, tzinfo=UTC)) == date(2026, 10, 26)

    def test_an_order_late_at_night_belongs_to_that_evening(self) -> None:
        """23h30 in São Paulo is already the next day in UTC."""
        assert business_date_of(datetime(2026, 10, 27, 2, 30, tzinfo=UTC)) == date(2026, 10, 26)

    def test_the_day_turns_at_midnight_in_sao_paulo(self) -> None:
        assert business_date_of(datetime(2026, 10, 27, 3, 0, tzinfo=UTC)) == date(2026, 10, 27)


def test_order_total_is_the_sum_of_its_items() -> None:
    order = Order(
        id=uuid.uuid4(),
        store_slug="lanchonete-bem-te-vi",
        number=1,
        business_date=date(2026, 10, 26),
        status=OrderStatus.RECEIVED,
        dine_in=True,
        payment_method=PaymentMethod.PIX,
        items=(
            OrderItem(product_id="xsalada", name="X-salada", quantity=2, unit_price_cents=2290),
            OrderItem(product_id="refri", name="Refrigerante", quantity=3, unit_price_cents=690),
        ),
        created_at=datetime(2026, 10, 26, 15, 0, tzinfo=UTC),
    )

    assert order.total_cents == 2 * 2290 + 3 * 690


def _order_in(status: OrderStatus, number: int = 47) -> Order:
    return Order(
        id=uuid.uuid4(),
        store_slug="lanchonete-bem-te-vi",
        number=number,
        business_date=date(2026, 10, 26),
        status=status,
        dine_in=False,
        payment_method=PaymentMethod.CARD,
        items=(
            OrderItem(product_id="refri", name="Refrigerante", quantity=1, unit_price_cents=690),
        ),
        created_at=datetime(2026, 10, 26, 15, 0, tzinfo=UTC),
    )


class TestStatusChange:
    @pytest.mark.parametrize(
        ("current", "requested"),
        [
            (OrderStatus.RECEIVED, OrderStatus.PREPARING),
            (OrderStatus.PREPARING, OrderStatus.READY),
            (OrderStatus.READY, OrderStatus.DELIVERED),
        ],
        ids=["start-preparing", "mark-ready", "deliver"],
    )
    def test_moves_one_step_forward(self, current: OrderStatus, requested: OrderStatus) -> None:
        order = _order_in(current)

        assert order.moved_to(requested) == replace(order, status=requested)

    @pytest.mark.parametrize(
        ("current", "requested"),
        [
            (OrderStatus.PREPARING, OrderStatus.RECEIVED),
            (OrderStatus.READY, OrderStatus.PREPARING),
            (OrderStatus.DELIVERED, OrderStatus.READY),
        ],
        ids=["undo-preparing", "undo-ready", "undo-delivered"],
    )
    def test_moves_one_step_back_so_the_dashboard_can_undo(
        self, current: OrderStatus, requested: OrderStatus
    ) -> None:
        order = _order_in(current)

        assert order.moved_to(requested) == replace(order, status=requested)

    @pytest.mark.parametrize(
        ("current", "requested", "message"),
        [
            (
                OrderStatus.RECEIVED,
                OrderStatus.READY,
                "O pedido 047 não pode passar de recebido para pronto.",
            ),
            (
                OrderStatus.RECEIVED,
                OrderStatus.DELIVERED,
                "O pedido 047 não pode passar de recebido para entregue.",
            ),
            (
                OrderStatus.PREPARING,
                OrderStatus.DELIVERED,
                "O pedido 047 não pode passar de em preparo para entregue.",
            ),
            (
                OrderStatus.READY,
                OrderStatus.RECEIVED,
                "O pedido 047 não pode passar de pronto para recebido.",
            ),
            (
                OrderStatus.DELIVERED,
                OrderStatus.PREPARING,
                "O pedido 047 não pode passar de entregue para em preparo.",
            ),
            (
                OrderStatus.DELIVERED,
                OrderStatus.RECEIVED,
                "O pedido 047 não pode passar de entregue para recebido.",
            ),
            (
                OrderStatus.PREPARING,
                OrderStatus.PREPARING,
                "O pedido 047 não pode passar de em preparo para em preparo.",
            ),
        ],
        ids=[
            "skip-preparing",
            "skip-to-delivered",
            "skip-ready",
            "two-back",
            "two-back-from-delivered",
            "three-back",
            "same-status",
        ],
    )
    def test_refuses_anything_else_naming_the_order_and_both_statuses(
        self, current: OrderStatus, requested: OrderStatus, message: str
    ) -> None:
        with pytest.raises(StatusChangeNotAllowedError) as raised:
            _order_in(current).moved_to(requested)

        assert str(raised.value) == message

    def test_a_number_past_three_digits_is_shown_whole(self) -> None:
        with pytest.raises(StatusChangeNotAllowedError) as raised:
            _order_in(OrderStatus.RECEIVED, number=1203).moved_to(OrderStatus.DELIVERED)

        assert str(raised.value) == "O pedido 1203 não pode passar de recebido para entregue."

    def test_every_status_has_a_label(self) -> None:
        """A status without one would turn a refused change into a 500."""
        assert set(STATUS_LABELS) == set(OrderStatus)
