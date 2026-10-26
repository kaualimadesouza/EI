from fastapi import FastAPI

from topa_api.adapters.db.session import DatabaseReadinessProbe, get_engine
from topa_api.presentation.fastapi.dependencies import bind_readiness_probe
from topa_api.presentation.fastapi.health import router as health_router


def create_app() -> FastAPI:
    """Composition root: the one place that picks the adapter behind each port."""
    app = FastAPI(title="TOPA API")
    bind_readiness_probe(app, DatabaseReadinessProbe(get_engine()))
    app.include_router(health_router)
    return app


app = create_app()
