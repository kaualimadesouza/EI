from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from topa_api.adapters.clock import SystemClock
from topa_api.adapters.db.repositories import (
    SqlAlchemyOrderRepository,
    SqlAlchemyProductRepository,
)
from topa_api.adapters.db.session import DatabaseReadinessProbe, get_engine
from topa_api.application.ports import OrderRepository, ProductRepository
from topa_api.presentation.fastapi import dependencies as ports
from topa_api.presentation.fastapi.errors import install_error_handlers
from topa_api.presentation.fastapi.health import router as health_router
from topa_api.presentation.fastapi.orders import router as orders_router
from topa_api.presentation.fastapi.products import router as products_router
from topa_api.settings import Settings


def get_session(engine: Annotated[Engine, Depends(get_engine)]) -> Iterator[Session]:
    """One transaction per request. Depend on it with scope="function": the default
    scope commits after the response is sent, so a failed commit would still say 2xx."""
    with Session(engine) as session, session.begin():
        yield session


def product_repository(
    session: Annotated[Session, Depends(get_session, scope="function")],
) -> ProductRepository:
    return SqlAlchemyProductRepository(session)


def order_repository(
    session: Annotated[Session, Depends(get_session, scope="function")],
) -> OrderRepository:
    return SqlAlchemyOrderRepository(session)


def create_app() -> FastAPI:
    """Composition root: the one place that picks the adapter behind each port."""
    app = FastAPI(title="TOPA API")
    # the site and the apps' webviews call from other origins; the origin list is the gate,
    # so any method or header a route adds later passes the preflight
    app.add_middleware(
        CORSMiddleware,
        allow_origins=Settings().cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(app)
    probe = DatabaseReadinessProbe(get_engine())
    app.dependency_overrides.update(
        {
            ports.get_readiness_probe: lambda: probe,
            ports.get_product_repository: product_repository,
            ports.get_order_repository: order_repository,
            ports.get_clock: SystemClock,
        }
    )
    app.include_router(health_router)
    app.include_router(products_router)
    app.include_router(orders_router)
    return app


app = create_app()
