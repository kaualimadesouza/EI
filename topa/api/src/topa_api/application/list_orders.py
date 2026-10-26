from datetime import date

from topa_api.application.ports import Clock, OrderRepository
from topa_api.domain.orders import Order, business_date_of


class ListOrdersUseCase:
    def __init__(self, orders: OrderRepository, clock: Clock) -> None:
        self._orders = orders
        self._clock = clock

    def execute(self, business_date: date | None) -> list[Order]:
        """Today unless another day is asked for; today is the shop's, not the server's."""
        if business_date is None:
            business_date = business_date_of(self._clock.now())
        return self._orders.list_for_day(business_date)
