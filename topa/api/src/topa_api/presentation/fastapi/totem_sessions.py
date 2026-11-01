from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from topa_api.application.create_totem_session import CreateTotemSessionUseCase
from topa_api.application.validate_totem_session import ValidateTotemSessionUseCase
from topa_api.presentation.fastapi.dependencies import (
    get_create_totem_session_use_case,
    get_validate_totem_session_use_case,
)

router = APIRouter(prefix="/totem", tags=["totem"])


class CreateTotemSessionPayload(BaseModel):
    store_slug: str
    duration_seconds: int = Field(default=1800, ge=60, le=86400)


class TotemSessionResponse(BaseModel):
    token: str
    store_slug: str
    expires_at: datetime
    url: str


class TotemSessionValidationResponse(BaseModel):
    valid: bool
    store_slug: str | None = None
    expires_at: datetime | None = None
    seconds_remaining: int = 0
    reason: str | None = None


@router.post("/sessions", response_model=TotemSessionResponse)
@router.post("/session", response_model=TotemSessionResponse, include_in_schema=False)
def create_totem_session(
    payload: CreateTotemSessionPayload,
    use_case: Annotated[CreateTotemSessionUseCase, Depends(get_create_totem_session_use_case)],
) -> TotemSessionResponse:
    """Creates a temporary signed link for a customer to order from a totem."""
    output = use_case.execute(
        store_slug=payload.store_slug, duration_seconds=payload.duration_seconds
    )
    return TotemSessionResponse(
        token=output.token,
        store_slug=output.store_slug,
        expires_at=output.expires_at,
        url=output.url,
    )


@router.get("/sessions/validate", response_model=TotemSessionValidationResponse)
@router.get(
    "/session/validate",
    response_model=TotemSessionValidationResponse,
    include_in_schema=False,
)
def validate_totem_session(
    token: Annotated[str, Query(...)],
    use_case: Annotated[ValidateTotemSessionUseCase, Depends(get_validate_totem_session_use_case)],
    store_slug: Annotated[str | None, Query()] = None,
) -> TotemSessionValidationResponse:
    """Validates if a temporary totem session token is genuine and active."""
    result = use_case.execute(token=token, expected_store_slug=store_slug)
    return TotemSessionValidationResponse(
        valid=result.valid,
        store_slug=result.store_slug,
        expires_at=result.expires_at,
        seconds_remaining=result.seconds_remaining,
        reason=result.reason,
    )
