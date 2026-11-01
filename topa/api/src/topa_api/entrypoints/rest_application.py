from collections.abc import Iterator
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from topa_api.adapters.clock import SystemClock
from topa_api.adapters.db.repositories import (
    SqlAlchemyCustomerRepository,
    SqlAlchemyMerchantRepository,
    SqlAlchemyOrderRepository,
    SqlAlchemyProductRepository,
    SqlAlchemyStoreRepository,
)
from topa_api.adapters.db.session import DatabaseReadinessProbe, get_engine
from topa_api.adapters.rate_limiter import InMemoryRateLimiter
from topa_api.adapters.security.google_token_verifier import GoogleTokenVerifier
from topa_api.adapters.security.password_hasher import ScryptPasswordHasher
from topa_api.adapters.security.token_service import HmacTokenService
from topa_api.application.ports import (
    CustomerRepositoryPort,
    MerchantRepositoryPort,
    OrderRepository,
    ProductRepository,
    StoreRepository,
)
from topa_api.domain.pos_integration import FileDropPosAdapter
from topa_api.presentation.fastapi import dependencies as ports
from topa_api.presentation.fastapi.auth import router as auth_router
from topa_api.presentation.fastapi.errors import install_error_handlers
from topa_api.presentation.fastapi.health import router as health_router
from topa_api.presentation.fastapi.orders import router as orders_router
from topa_api.presentation.fastapi.products import router as products_router
from topa_api.presentation.fastapi.recommendations import router as recommendations_router
from topa_api.presentation.fastapi.stores import router as stores_router
from topa_api.presentation.fastapi.totem_sessions import router as totem_sessions_router
from topa_api.settings import Settings


def get_session(engine: Annotated[Engine, Depends(get_engine)]) -> Iterator[Session]:
    """One transaction per request. Depend on it with scope="function": the default
    scope commits after the response is sent, so a failed commit would still say 2xx."""
    with Session(engine) as session, session.begin():
        yield session


def store_repository(
    session: Annotated[Session, Depends(get_session, scope="function")],
) -> StoreRepository:
    return SqlAlchemyStoreRepository(session)


def product_repository(
    session: Annotated[Session, Depends(get_session, scope="function")],
) -> ProductRepository:
    return SqlAlchemyProductRepository(session)


def order_repository(
    session: Annotated[Session, Depends(get_session, scope="function")],
) -> OrderRepository:
    return SqlAlchemyOrderRepository(session)


def merchant_repository(
    session: Annotated[Session, Depends(get_session, scope="function")],
) -> MerchantRepositoryPort:
    return SqlAlchemyMerchantRepository(session)


def customer_repository(
    session: Annotated[Session, Depends(get_session, scope="function")],
) -> CustomerRepositoryPort:
    return SqlAlchemyCustomerRepository(session)


def create_app() -> FastAPI:
    """Composition root: the one place that picks the adapter behind each port."""
    app = FastAPI(title="TOPA API")
    settings = Settings()
    # the site and the apps' webviews call from other origins; the origins are the gate,
    # so any method or header a route adds later passes the preflight
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(app)
    probe = DatabaseReadinessProbe(get_engine())
    hasher = ScryptPasswordHasher()
    tokens = HmacTokenService(secret_key=settings.auth_secret_key)
    limiter = InMemoryRateLimiter(limit=10, window_seconds=60)
    pos_adapter = FileDropPosAdapter(Path("/tmp/topa_pos_export"))
    google_verifier = GoogleTokenVerifier()
    app.dependency_overrides.update(
        {
            ports.get_readiness_probe: lambda: probe,
            ports.get_store_repository: store_repository,
            ports.get_product_repository: product_repository,
            ports.get_order_repository: order_repository,
            ports.get_merchant_repository: merchant_repository,
            ports.get_customer_repository: customer_repository,
            ports.get_password_hasher: lambda: hasher,
            ports.get_token_service: lambda: tokens,
            ports.get_google_token_verifier: lambda: google_verifier,
            ports.get_rate_limiter: lambda: limiter,
            ports.get_clock: SystemClock,
            ports.get_pos_adapter: lambda: pos_adapter,
        }
    )
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(stores_router)
    app.include_router(products_router)
    app.include_router(orders_router)
    app.include_router(recommendations_router)
    app.include_router(totem_sessions_router)
    return app


app = create_app()
