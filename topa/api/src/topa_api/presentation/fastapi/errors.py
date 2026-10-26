import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from topa_api.domain.errors import (
    DomainError,
    EmptyOrderError,
    OrderNumberTakenError,
    ProductUnavailableError,
    QuantityOutOfRangeError,
    UnknownProductError,
)

_logger = logging.getLogger(__name__)

ERROR_STATUS: dict[type[DomainError], int] = {
    EmptyOrderError: 422,
    QuantityOutOfRangeError: 422,
    UnknownProductError: 422,
    ProductUnavailableError: 409,
    OrderNumberTakenError: 409,
}

INVALID_REQUEST = "Não foi possível processar a solicitação. Tente de novo."


class ErrorResponse(BaseModel):
    """Every error body: one pt-BR sentence the kiosk can show as it is."""

    detail: str


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def handle_domain_error(request: Request, error: DomainError) -> JSONResponse:
        return JSONResponse(
            status_code=ERROR_STATUS[type(error)],
            content=ErrorResponse(detail=str(error)).model_dump(),
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
