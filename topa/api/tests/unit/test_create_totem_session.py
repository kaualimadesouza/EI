from datetime import UTC, datetime

import pytest

from tests.fakes import FixedClock, InMemoryStoreRepository
from topa_api.adapters.security.token_service import HmacTokenService
from topa_api.application.create_totem_session import CreateTotemSessionUseCase
from topa_api.domain.catalog import Store
from topa_api.domain.errors import StoreNotFoundError


def test_create_totem_session_success() -> None:
    clock = FixedClock(datetime(2026, 10, 31, 20, 0, tzinfo=UTC))
    tokens = HmacTokenService(secret_key="secret", clock=clock)
    stores = InMemoryStoreRepository([Store(slug="brasa-burgers", name="Brasa Burgers")])
    use_case = CreateTotemSessionUseCase(
        tokens, stores, base_url="https://topa-totem.vercel.app"
    )

    output = use_case.execute(store_slug="brasa-burgers", duration_seconds=1800)

    assert output.store_slug == "brasa-burgers"
    assert output.expires_at == datetime(2026, 10, 31, 20, 30, tzinfo=UTC)
    assert output.url.startswith("https://topa-totem.vercel.app/?loja=brasa-burgers&sessao=")
    assert output.token in output.url


def test_create_totem_session_store_not_found() -> None:
    clock = FixedClock(datetime(2026, 10, 31, 20, 0, tzinfo=UTC))
    tokens = HmacTokenService(secret_key="secret", clock=clock)
    stores = InMemoryStoreRepository([])
    use_case = CreateTotemSessionUseCase(tokens, stores)

    with pytest.raises(StoreNotFoundError):
        use_case.execute(store_slug="inexistente")
