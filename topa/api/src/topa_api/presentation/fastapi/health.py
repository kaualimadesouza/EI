from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel

from topa_api.application.ports import ReadinessProbe
from topa_api.presentation.fastapi.dependencies import get_readiness_probe

router = APIRouter()


class HealthResponse(BaseModel):
    status: Literal["ok"]


class ReadyResponse(BaseModel):
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
def ready(
    probe: Annotated[ReadinessProbe, Depends(get_readiness_probe)], response: Response
) -> ReadyResponse:
    """Readiness: 503 while Postgres does not answer, so the compose healthcheck
    keeps the container unhealthy instead of letting it serve errors."""
    if probe.database_is_up():
        return ReadyResponse(database="up")
    response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return ReadyResponse(database="down")
