from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from topa_api.application.authenticate_merchant import AuthenticateMerchantUseCase
from topa_api.domain.auth import Credentials
from topa_api.presentation.fastapi.dependencies import get_authenticate_merchant_use_case
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
