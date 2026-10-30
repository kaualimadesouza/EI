from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from topa_api.application.get_recommendations import (
    GetRecommendations,
    GetRecommendationsQuery,
)
from topa_api.presentation.fastapi.dependencies import (
    StoreSlug,
    get_recommendations_use_case,
)

router = APIRouter(tags=["recommendations"])


class RecommendationRequest(BaseModel):
    cart_product_ids: list[str] = Field(default_factory=list)
    client_id: str | None = None
    limit: int = Field(default=3, ge=1, le=10)


class RecommendationItemResponse(BaseModel):
    product_id: str
    name: str
    price_cents: int
    category: str
    score: float
    reason: str


class RecommendationListResponse(BaseModel):
    items: list[RecommendationItemResponse]
    strategy_used: str
    ab_group: str


@router.post("/stores/{store_slug}/recommendations")
def get_recommendations(
    store_slug: StoreSlug,
    payload: RecommendationRequest,
    use_case: Annotated[GetRecommendations, Depends(get_recommendations_use_case)],
) -> RecommendationListResponse:
    """Returns basket recommendations and upsell items for the store menu."""
    query = GetRecommendationsQuery(
        store_slug=store_slug,
        cart_product_ids=tuple(payload.cart_product_ids),
        client_id=payload.client_id,
        limit=payload.limit,
    )
    result = use_case.execute(query)
    return RecommendationListResponse(
        items=[
            RecommendationItemResponse(
                product_id=item.product_id,
                name=item.name,
                price_cents=item.price_cents,
                category=item.category,
                score=item.score,
                reason=item.reason,
            )
            for item in result.items
        ],
        strategy_used=result.strategy_used,
        ab_group=result.ab_group,
    )
