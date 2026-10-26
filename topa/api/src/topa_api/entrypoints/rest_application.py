from fastapi import FastAPI

from topa_api.presentation.fastapi.health import router as health_router


def create_app() -> FastAPI:
    app = FastAPI(title="TOPA API")
    app.include_router(health_router)
    return app


app = create_app()
