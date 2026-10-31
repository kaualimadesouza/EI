import uuid

from topa_api.application.ports import OrderRepository, StoreRepository
from topa_api.domain.errors import OrderNotFoundError
from topa_api.domain.fiscal import build_fiscal_document, get_store_fiscal_profile
from topa_api.domain.pos_integration import PosAdapterPort, PosExportResult


def export_order_to_pos(
    order_id: uuid.UUID,
    adapter: PosAdapterPort,
    order_repo: OrderRepository,
    store_repo: StoreRepository,
) -> PosExportResult:
    order = order_repo.get(order_id)
    if order is None:
        raise OrderNotFoundError()
    store = store_repo.get(order.store_slug)
    store_name = store.name if store else order.store_slug
    profile = get_store_fiscal_profile(order.store_slug, store_name=store_name)
    fiscal_doc = build_fiscal_document(order, profile)
    return adapter.export_order(order, profile, fiscal_doc)
