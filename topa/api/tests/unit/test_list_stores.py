from topa_api.application.list_stores import ListStoresUseCase
from topa_api.domain.catalog import Store


class FakeStoreRepository:
    def __init__(self, stores: list[Store]) -> None:
        self._stores = stores

    def get(self, slug: str) -> Store | None:
        for store in self._stores:
            if store.slug == slug:
                return store
        return None

    def list_all(self) -> list[Store]:
        return list(self._stores)


def test_list_stores_returns_all_stores() -> None:
    stores = [
        Store(slug="brasa-burgers", name="Brasa Burgers"),
        Store(slug="bella-nonna", name="Cantina Bella Nonna"),
    ]
    repo = FakeStoreRepository(stores)
    use_case = ListStoresUseCase(repo)

    result = use_case.execute()

    assert result == stores
