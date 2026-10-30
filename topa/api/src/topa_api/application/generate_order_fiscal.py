import uuid

from topa_api.application.ports import OrderRepository, StoreRepository
from topa_api.domain.errors import OrderNotFoundError
from topa_api.domain.fiscal import (
    FiscalDocument,
    FiscalEnvironment,
    FiscalStandard,
    build_fiscal_document,
    get_store_fiscal_profile,
)


def generate_order_fiscal(
    order_id: uuid.UUID,
    order_repo: OrderRepository,
    store_repo: StoreRepository,
    standard: FiscalStandard = FiscalStandard.NFCE,
    environment: FiscalEnvironment = FiscalEnvironment.HOMOLOGATION,
) -> FiscalDocument:
    order = order_repo.get(order_id)
    if order is None:
        raise OrderNotFoundError()
    store = store_repo.get(order.store_slug)
    store_name = store.name if store else None
    profile = get_store_fiscal_profile(order.store_slug, store_name=store_name)
    return build_fiscal_document(
        order=order,
        profile=profile,
        standard=standard,
        environment=environment,
    )
