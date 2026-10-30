from topa_api.application.ports import StoreRepository
from topa_api.domain.catalog import Store


class ListStoresUseCase:
    """Returns all registered stores ordered for display."""

    def __init__(self, stores: StoreRepository) -> None:
        self._stores = stores

    def execute(self) -> list[Store]:
        return self._stores.list_all()
