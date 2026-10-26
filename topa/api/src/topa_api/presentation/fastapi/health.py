from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy import Engine

from topa_api.adapters.db.session import database_is_up, get_engine

router = APIRouter()


class HealthResponse(BaseModel):
    status: Literal["ok"]


class ReadyResponse(BaseModel):
    status: Literal["ok", "unavailable"]
    database: Literal["up", "down"]


@router.get("/health")
def health() -> HealthResponse:
    """Liveness, dependency-free on purpose: a probe must tell a dead process
    from one that is up but cannot reach the database."""
    return HealthResponse(status="ok")


@router.get(
    "/health/ready",
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"model": ReadyResponse}},
)
def ready(engine: Annotated[Engine, Depends(get_engine)], response: Response) -> ReadyResponse:
    """Readiness: 503 while Postgres does not answer, so the compose healthcheck
    keeps the container unhealthy instead of letting it serve errors."""
    if database_is_up(engine):
        return ReadyResponse(status="ok", database="up")
    response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return ReadyResponse(status="unavailable", database="down")
