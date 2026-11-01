import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from topa_api.domain.errors import (
    DomainError,
    DuplicateClientOrderIdError,
    DuplicateProductError,
    EmailAlreadyInUseError,
    EmptyOrderError,
    ExpiredTokenError,
    ForbiddenStoreAccessError,
    IdempotencyConflictError,
    InvalidCredentialsError,
    InvalidCustomerDataError,
    InvalidIdempotencyKeyError,
    InvalidProductDataError,
    InvalidTokenError,
    OrderNotFoundError,
    ProductNotFoundError,
    ProductUnavailableError,
    QuantityOutOfRangeError,
    RateLimitExceededError,
    StatusChangeNotAllowedError,
    StoreNotFoundError,
    UnknownProductError,
)

_logger = logging.getLogger(__name__)

ERROR_STATUS: dict[type[DomainError], int] = {
    EmptyOrderError: 422,
    QuantityOutOfRangeError: 422,
    UnknownProductError: 422,
    ProductUnavailableError: 409,
    StoreNotFoundError: 404,
    OrderNotFoundError: 404,
    ProductNotFoundError: 404,
    DuplicateProductError: 409,
    StatusChangeNotAllowedError: 409,
    InvalidCredentialsError: 401,
    InvalidTokenError: 401,
    ExpiredTokenError: 401,
    ForbiddenStoreAccessError: 403,
    InvalidProductDataError: 422,
    RateLimitExceededError: 429,
    EmailAlreadyInUseError: 409,
    InvalidCustomerDataError: 422,
    InvalidIdempotencyKeyError: 422,
    IdempotencyConflictError: 409,
    DuplicateClientOrderIdError: 409,
}

INVALID_REQUEST = "Não foi possível processar a solicitação. Tente de novo."


class ErrorResponse(BaseModel):
    """Every error body: one pt-BR sentence the kiosk can show as it is."""

    detail: str


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def handle_domain_error(request: Request, error: DomainError) -> JSONResponse:
        headers = {}
        if isinstance(error, RateLimitExceededError):
            headers["Retry-After"] = str(error.retry_after)
        return JSONResponse(
            status_code=ERROR_STATUS[type(error)],
            content=ErrorResponse(detail=str(error)).model_dump(),
            headers=headers if headers else None,
        )

    @app.exception_handler(RequestValidationError)
    async def handle_invalid_request(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        # only a kiosk bug sends a malformed body: the screen gets a sentence, the log the cause
        _logger.warning("invalid request to %s: %s", request.url.path, error.errors())
        return JSONResponse(
            status_code=422, content=ErrorResponse(detail=INVALID_REQUEST).model_dump()
        )
