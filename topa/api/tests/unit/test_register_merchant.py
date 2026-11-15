from datetime import UTC, datetime

import pytest

from tests.fakes import (
    FakeMerchantRepository,
    FakePasswordHasher,
    FakeTokenService,
    FixedClock,
    InMemoryStoreRepository,
)
from topa_api.application.register_merchant import RegisterMerchantUseCase
from topa_api.domain.auth import MerchantRegistration
from topa_api.domain.errors import InvalidMerchantDataError


@pytest.mark.parametrize(
    "name,email,password",
    [
        (" ", "a@b.com", "password1"),
        ("x" * 101, "a@b.com", "password1"),
        ("Loja", "a@", "password1"),
        ("Loja", "@a.com", "password1"),
        ("Loja", "sem-arroba", "password1"),
        ("Loja", "a b@c.com", "password1"),
        ("Loja", "a@b", "password1"),
        ("Loja", "a@b..com", "password1"),
        ("Loja", "x" * 250 + "@b.com", "password1"),
        ("Loja", "a@b.com", "short"),
        ("Loja", "a@b.com", "x" * 129),
    ],
)
def test_invalid_registration_never_creates_store(name: str, email: str, password: str) -> None:
    stores = InMemoryStoreRepository([])
    merchants = FakeMerchantRepository()
    use_case = RegisterMerchantUseCase(
        stores,
        merchants,
        FakePasswordHasher(),
        FakeTokenService(),
        FixedClock(datetime(2026, 11, 15, 12, tzinfo=UTC)),
    )
    with pytest.raises(InvalidMerchantDataError):
        use_case.execute(MerchantRegistration(name, email, password))
    assert stores.stores == []
    assert merchants.merchants == []


@pytest.mark.parametrize(
    "name,prefix", [(" Pão & Café ", "pao-cafe"), ("餐厅", "loja"), ("X" * 100, "x" * 48)]
)
def test_registration_builds_unique_valid_urls_and_normalizes_email(name: str, prefix: str) -> None:
    stores = InMemoryStoreRepository([])
    use_case = RegisterMerchantUseCase(
        stores,
        FakeMerchantRepository(),
        FakePasswordHasher(),
        FakeTokenService(),
        FixedClock(datetime(2026, 11, 15, 12, tzinfo=UTC)),
    )
    first = use_case.execute(MerchantRegistration(name, " OWNER@EXAMPLE.COM ", "password1"))
    second = use_case.execute(MerchantRegistration(name, "outro@example.com", "password1"))
    assert first.email == "owner@example.com"
    assert first.store_slug.startswith(prefix + "-")
    assert first.store_slug != second.store_slug
    assert len(first.store_slug) <= 64
    store = stores.get(first.store_slug)
    assert store is not None
    assert store.name == name.strip()
