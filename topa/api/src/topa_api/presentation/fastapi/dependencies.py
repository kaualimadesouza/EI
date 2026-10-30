from typing import Annotated

from fastapi import Depends, Header
from pydantic import StringConstraints

from topa_api.application.authenticate_customer import AuthenticateCustomerUseCase
from topa_api.application.authenticate_merchant import AuthenticateMerchantUseCase
from topa_api.application.change_order_status import ChangeOrderStatusUseCase
from topa_api.application.check_order_rate_limit import CheckOrderRateLimitUseCase
from topa_api.application.create_product import CreateProductUseCase
from topa_api.application.get_recommendations import GetRecommendations
from topa_api.application.get_store_menu import GetStoreMenuUseCase
from topa_api.application.list_customer_orders import ListCustomerOrdersUseCase
from topa_api.application.list_orders import ListOrdersUseCase
from topa_api.application.list_stores import ListStoresUseCase
from topa_api.application.place_order import PlaceOrderUseCase
from topa_api.application.ports import (
    Clock,
    CustomerRepositoryPort,
    MerchantRepositoryPort,
    OrderRepository,
    PasswordHasherPort,
    ProductRepository,
    RateLimiterPort,
    ReadinessProbe,
    StoreRepository,
    TokenServicePort,
)
from topa_api.application.read_order import ReadOrderUseCase
from topa_api.application.register_customer import RegisterCustomerUseCase
from topa_api.application.set_product_availability import SetProductAvailabilityUseCase
from topa_api.application.update_product import UpdateProductUseCase
from topa_api.application.verify_customer_token import VerifyCustomerTokenUseCase
from topa_api.application.verify_merchant_token import VerifyMerchantTokenUseCase
from topa_api.domain.auth import AuthenticatedCustomer, AuthenticatedMerchant
from topa_api.domain.catalog import STORE_SLUG_MAX_LENGTH, STORE_SLUG_PATTERN
from topa_api.domain.errors import InvalidTokenError

StoreSlug = Annotated[
    str, StringConstraints(pattern=STORE_SLUG_PATTERN, max_length=STORE_SLUG_MAX_LENGTH)
]

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


def get_create_product_use_case(
    stores: Annotated[StoreRepository, Depends(get_store_repository)],
    products: Annotated[ProductRepository, Depends(get_product_repository)],
) -> CreateProductUseCase:
    return CreateProductUseCase(stores, products)


def get_update_product_use_case(
    stores: Annotated[StoreRepository, Depends(get_store_repository)],
    products: Annotated[ProductRepository, Depends(get_product_repository)],
) -> UpdateProductUseCase:
    return UpdateProductUseCase(stores, products)


def get_merchant_repository() -> MerchantRepositoryPort:
    raise NotImplementedError


def get_password_hasher() -> PasswordHasherPort:
    raise NotImplementedError


def get_token_service() -> TokenServicePort:
    raise NotImplementedError


def get_rate_limiter() -> RateLimiterPort:
    raise NotImplementedError


def get_authenticate_merchant_use_case(
    merchants: Annotated[MerchantRepositoryPort, Depends(get_merchant_repository)],
    hasher: Annotated[PasswordHasherPort, Depends(get_password_hasher)],
    tokens: Annotated[TokenServicePort, Depends(get_token_service)],
) -> AuthenticateMerchantUseCase:
    return AuthenticateMerchantUseCase(merchants, hasher, tokens)


def get_verify_merchant_token_use_case(
    tokens: Annotated[TokenServicePort, Depends(get_token_service)],
) -> VerifyMerchantTokenUseCase:
    return VerifyMerchantTokenUseCase(tokens)


def get_check_order_rate_limit_use_case(
    limiter: Annotated[RateLimiterPort, Depends(get_rate_limiter)],
) -> CheckOrderRateLimitUseCase:
    return CheckOrderRateLimitUseCase(limiter)


def get_current_merchant(
    use_case: Annotated[VerifyMerchantTokenUseCase, Depends(get_verify_merchant_token_use_case)],
    authorization: Annotated[str | None, Header()] = None,
) -> AuthenticatedMerchant:
    if authorization is None:
        raise InvalidTokenError("Token de autenticação não fornecido.")
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise InvalidTokenError("Formato de autorização inválido. Utilize Bearer <token>.")
    return use_case.execute(parts[1].strip())


def get_list_stores_use_case(
    stores: Annotated[StoreRepository, Depends(get_store_repository)],
) -> ListStoresUseCase:
    return ListStoresUseCase(stores)


def get_customer_repository() -> CustomerRepositoryPort:
    raise NotImplementedError


def get_register_customer_use_case(
    customers: Annotated[CustomerRepositoryPort, Depends(get_customer_repository)],
    hasher: Annotated[PasswordHasherPort, Depends(get_password_hasher)],
    tokens: Annotated[TokenServicePort, Depends(get_token_service)],
    clock: Annotated[Clock, Depends(get_clock)],
) -> RegisterCustomerUseCase:
    return RegisterCustomerUseCase(customers, hasher, tokens, clock)


def get_authenticate_customer_use_case(
    customers: Annotated[CustomerRepositoryPort, Depends(get_customer_repository)],
    hasher: Annotated[PasswordHasherPort, Depends(get_password_hasher)],
    tokens: Annotated[TokenServicePort, Depends(get_token_service)],
) -> AuthenticateCustomerUseCase:
    return AuthenticateCustomerUseCase(customers, hasher, tokens)


def get_verify_customer_token_use_case(
    tokens: Annotated[TokenServicePort, Depends(get_token_service)],
) -> VerifyCustomerTokenUseCase:
    return VerifyCustomerTokenUseCase(tokens)


def get_list_customer_orders_use_case(
    orders: Annotated[OrderRepository, Depends(get_order_repository)],
) -> ListCustomerOrdersUseCase:
    return ListCustomerOrdersUseCase(orders)


def get_current_customer(
    use_case: Annotated[VerifyCustomerTokenUseCase, Depends(get_verify_customer_token_use_case)],
    authorization: Annotated[str | None, Header()] = None,
) -> AuthenticatedCustomer:
    if authorization is None:
        raise InvalidTokenError("Token de autenticação não fornecido.")
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise InvalidTokenError("Formato de autorização inválido. Utilize Bearer <token>.")
    return use_case.execute(parts[1].strip())


def get_optional_customer(
    use_case: Annotated[VerifyCustomerTokenUseCase, Depends(get_verify_customer_token_use_case)],
    authorization: Annotated[str | None, Header()] = None,
) -> AuthenticatedCustomer | None:
    if authorization is None:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise InvalidTokenError("Formato de autorização inválido. Utilize Bearer <token>.")
    return use_case.execute(parts[1].strip())


def get_recommendations_use_case(
    stores: Annotated[StoreRepository, Depends(get_store_repository)],
    products: Annotated[ProductRepository, Depends(get_product_repository)],
    orders: Annotated[OrderRepository, Depends(get_order_repository)],
    clock: Annotated[Clock, Depends(get_clock)],
) -> GetRecommendations:
    return GetRecommendations(stores, products, orders, clock)
