from dataclasses import dataclass

from topa_api.application.ports import Clock, OrderRepository, ProductRepository, StoreRepository
from topa_api.domain.errors import StoreNotFoundError
from topa_api.domain.orders import BUSINESS_TIMEZONE, business_date_of
from topa_api.domain.recommendations import (
    RecommendationResponse,
    determine_ab_group,
    rank_recommendations,
)


@dataclass(frozen=True)
class GetRecommendationsQuery:
    store_slug: str
    cart_product_ids: tuple[str, ...]
    client_id: str | None = None
    limit: int = 3


class GetRecommendations:
    """Orchestrates recommendation generation based on store catalog and past orders."""

    def __init__(
        self,
        store_repo: StoreRepository,
        product_repo: ProductRepository,
        order_repo: OrderRepository,
        clock: Clock,
    ) -> None:
        self.store_repo = store_repo
        self.product_repo = product_repo
        self.order_repo = order_repo
        self.clock = clock

    def execute(self, query: GetRecommendationsQuery) -> RecommendationResponse:
        store = self.store_repo.get(query.store_slug)
        if store is None:
            raise StoreNotFoundError()

        ab_group = determine_ab_group(query.client_id)
        now = self.clock.now()
        local_now = now.astimezone(BUSINESS_TIMEZONE)
        catalog = self.product_repo.list_for_store(query.store_slug)
        past_orders = self.order_repo.list_for_day(query.store_slug, business_date_of(now))

        return rank_recommendations(
            catalog=catalog,
            cart_product_ids=list(query.cart_product_ids),
            past_orders=past_orders,
            current_hour=local_now.hour,
            limit=query.limit,
            ab_group=ab_group,
        )
