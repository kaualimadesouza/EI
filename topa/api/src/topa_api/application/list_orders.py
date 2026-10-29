from datetime import date

from topa_api.application.ports import Clock, OrderRepository, StoreRepository
from topa_api.domain.errors import StoreNotFoundError
from topa_api.domain.orders import Order, business_date_of


class ListOrdersUseCase:
    def __init__(self, stores: StoreRepository, orders: OrderRepository, clock: Clock) -> None:
        self._stores = stores
        self._orders = orders
        self._clock = clock

    def execute(self, store_slug: str, business_date: date | None) -> list[Order]:
        """Today unless another day is asked for; today is the shop's, not the server's."""
        if self._stores.get(store_slug) is None:
            raise StoreNotFoundError
        if business_date is None:
            business_date = business_date_of(self._clock.now())
        return self._orders.list_for_day(store_slug, business_date)
