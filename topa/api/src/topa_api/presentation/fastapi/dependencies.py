from fastapi import FastAPI, Request

from topa_api.application.ports import ReadinessProbe


def bind_readiness_probe(app: FastAPI, probe: ReadinessProbe) -> None:
    """Called by the composition root, the only layer that knows the adapters."""
    app.state.readiness_probe = probe


def get_readiness_probe(request: Request) -> ReadinessProbe:
    probe: ReadinessProbe = request.app.state.readiness_probe
    return probe
