from tests.fakes import InMemoryStoreRepository
from topa_api.application.list_stores import ListStoresUseCase
from topa_api.domain.catalog import Store


def test_list_stores_returns_all_stores() -> None:
    stores = [
        Store(slug="brasa-burgers", name="Brasa Burgers"),
        Store(slug="bella-nonna", name="Cantina Bella Nonna"),
    ]
    repo = InMemoryStoreRepository(stores)
    use_case = ListStoresUseCase(repo)

    result = use_case.execute()

    assert result == stores
