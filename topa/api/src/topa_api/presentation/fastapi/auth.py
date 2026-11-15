from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from topa_api.application.authenticate_customer import AuthenticateCustomerUseCase
from topa_api.application.authenticate_merchant import AuthenticateMerchantUseCase
from topa_api.application.check_order_rate_limit import CheckOrderRateLimitUseCase
from topa_api.application.register_customer import RegisterCustomerUseCase
from topa_api.application.register_merchant import RegisterMerchantUseCase
from topa_api.domain.auth import (
    AuthenticatedCustomer,
    Credentials,
    CustomerCredentials,
    CustomerRegistration,
    MerchantRegistration,
)
from topa_api.presentation.fastapi.client_ip import client_ip
from topa_api.presentation.fastapi.dependencies import (
    get_authenticate_customer_use_case,
    get_authenticate_merchant_use_case,
    get_check_order_rate_limit_use_case,
    get_current_customer,
    get_register_customer_use_case,
    get_register_merchant_use_case,
)
from topa_api.presentation.fastapi.errors import ErrorResponse

router = APIRouter(tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    store_slug: str
    email: str


class CustomerRegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=6, max_length=128)


class MerchantRegisterRequest(BaseModel):
    store_name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


@router.post(
    "/auth/register",
    status_code=201,
    responses={
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        429: {"model": ErrorResponse},
    },
)
def register_merchant(
    request_obj: Request,
    request: MerchantRegisterRequest,
    use_case: Annotated[RegisterMerchantUseCase, Depends(get_register_merchant_use_case)],
    rate_limit: Annotated[CheckOrderRateLimitUseCase, Depends(get_check_order_rate_limit_use_case)],
) -> AuthResponse:
    rate_limit.execute("merchant-register:" + client_ip(request_obj))
    result = use_case.execute(
        MerchantRegistration(request.store_name, request.email, request.password)
    )
    return AuthResponse(
        access_token=result.access_token,
        token_type=result.token_type,
        store_slug=result.store_slug,
        email=result.email,
    )


class CustomerLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class CustomerAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    name: str
    email: str


class CustomerProfileResponse(BaseModel):
    id: str
    name: str
    email: str


@router.post(
    "/auth/login",
    responses={
        401: {"model": ErrorResponse, "description": "invalid email or password"},
        422: {"model": ErrorResponse, "description": "malformed request payload"},
    },
)
def login(
    request: LoginRequest,
    use_case: Annotated[AuthenticateMerchantUseCase, Depends(get_authenticate_merchant_use_case)],
) -> AuthResponse:
    """Authenticates a store merchant and issues a bearer access token."""
    result = use_case.execute(Credentials(email=request.email, password=request.password))
    return AuthResponse(
        access_token=result.access_token,
        token_type=result.token_type,
        store_slug=result.store_slug,
        email=result.email,
    )


@router.post(
    "/auth/customer/register",
    responses={
        409: {"model": ErrorResponse, "description": "email already in use"},
        422: {"model": ErrorResponse, "description": "invalid customer data"},
    },
)
def register_customer(
    request: CustomerRegisterRequest,
    use_case: Annotated[RegisterCustomerUseCase, Depends(get_register_customer_use_case)],
) -> CustomerAuthResponse:
    """Registers a new customer and returns a bearer access token."""
    result = use_case.execute(
        CustomerRegistration(
            name=request.name,
            email=request.email,
            password=request.password,
        )
    )
    return CustomerAuthResponse(
        access_token=result.access_token,
        token_type=result.token_type,
        name=result.name,
        email=result.email,
    )


@router.post(
    "/auth/customer/login",
    responses={
        401: {"model": ErrorResponse, "description": "invalid email or password"},
        422: {"model": ErrorResponse, "description": "malformed request payload"},
    },
)
def login_customer(
    request: CustomerLoginRequest,
    use_case: Annotated[AuthenticateCustomerUseCase, Depends(get_authenticate_customer_use_case)],
) -> CustomerAuthResponse:
    """Authenticates a customer and returns a bearer access token."""
    result = use_case.execute(
        CustomerCredentials(
            email=request.email,
            password=request.password,
        )
    )
    return CustomerAuthResponse(
        access_token=result.access_token,
        token_type=result.token_type,
        name=result.name,
        email=result.email,
    )


@router.get(
    "/auth/customer/me",
    responses={
        401: {"model": ErrorResponse, "description": "missing or invalid token"},
    },
)
def get_customer_profile(
    current_customer: Annotated[AuthenticatedCustomer, Depends(get_current_customer)],
) -> CustomerProfileResponse:
    """Returns the authenticated customer profile."""
    return CustomerProfileResponse(
        id=str(current_customer.id),
        name=current_customer.name,
        email=current_customer.email,
    )
