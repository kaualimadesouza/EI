from typing import Annotated

from fastapi import Depends
from pydantic import StringConstraints

from topa_api.application.change_order_status import ChangeOrderStatusUseCase
from topa_api.application.get_store_menu import GetStoreMenuUseCase
from topa_api.application.list_orders import ListOrdersUseCase
from topa_api.application.place_order import PlaceOrderUseCase
from topa_api.application.ports import (
    Clock,
    OrderRepository,
    ProductRepository,
    ReadinessProbe,
    StoreRepository,
)
from topa_api.application.read_order import ReadOrderUseCase
from topa_api.application.set_product_availability import SetProductAvailabilityUseCase
from topa_api.domain.catalog import STORE_SLUG_PATTERN

StoreSlug = Annotated[str, StringConstraints(pattern=STORE_SLUG_PATTERN, max_length=64)]

# The ports a route asks for. Presentation never sees an adapter: create_app() binds
# each of these to its adapter through dependency_overrides, and tests rebind them.


def get_readiness_probe() -> ReadinessProbe:
    raise NotImplementedError


def get_store_repository() -> StoreRepository:
    raise NotImplementedError


def get_product_repository() -> ProductRepository:
    raise NotImplementedError


def get_order_repository() -> OrderRepository:
    raise NotImplementedError


def get_clock() -> Clock:
    raise NotImplementedError


def get_store_menu_use_case(
    stores: Annotated[StoreRepository, Depends(get_store_repository)],
    products: Annotated[ProductRepository, Depends(get_product_repository)],
) -> GetStoreMenuUseCase:
    return GetStoreMenuUseCase(stores, products)


def get_place_order_use_case(
    stores: Annotated[StoreRepository, Depends(get_store_repository)],
    products: Annotated[ProductRepository, Depends(get_product_repository)],
    orders: Annotated[OrderRepository, Depends(get_order_repository)],
    clock: Annotated[Clock, Depends(get_clock)],
) -> PlaceOrderUseCase:
    return PlaceOrderUseCase(stores, products, orders, clock)


def get_list_orders_use_case(
    stores: Annotated[StoreRepository, Depends(get_store_repository)],
    orders: Annotated[OrderRepository, Depends(get_order_repository)],
    clock: Annotated[Clock, Depends(get_clock)],
) -> ListOrdersUseCase:
    return ListOrdersUseCase(stores, orders, clock)


def get_read_order_use_case(
    orders: Annotated[OrderRepository, Depends(get_order_repository)],
) -> ReadOrderUseCase:
    return ReadOrderUseCase(orders)


def get_change_order_status_use_case(
    orders: Annotated[OrderRepository, Depends(get_order_repository)],
) -> ChangeOrderStatusUseCase:
    return ChangeOrderStatusUseCase(orders)


def get_set_product_availability_use_case(
    stores: Annotated[StoreRepository, Depends(get_store_repository)],
    products: Annotated[ProductRepository, Depends(get_product_repository)],
) -> SetProductAvailabilityUseCase:
    return SetProductAvailabilityUseCase(stores, products)
