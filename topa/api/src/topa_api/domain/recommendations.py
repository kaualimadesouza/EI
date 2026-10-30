from dataclasses import dataclass
from enum import StrEnum
from hashlib import md5

from topa_api.domain.catalog import Category, Product
from topa_api.domain.orders import Order


class RecommendationStrategy(StrEnum):
    ASSOCIATION_RULES = "association_rules"
    TIME_OF_DAY = "time_of_day"
    POPULAR_FALLBACK = "popular_fallback"


@dataclass(frozen=True)
class RecommendationItem:
    product_id: str
    name: str
    price_cents: int
    category: str
    score: float
    reason: str


@dataclass(frozen=True)
class RecommendationResponse:
    items: tuple[RecommendationItem, ...]
    strategy_used: str
    ab_group: str


CATEGORY_COMPLEMENTS: dict[str, dict[str, tuple[float, str]]] = {
    Category.LANCHES: {
        Category.BEBIDAS: (0.95, "Acompanhamento ideal para matar a sede."),
        Category.SALGADOS: (0.80, "Adicione uma porção ao seu lanche."),
        Category.DOCES: (0.65, "Finalize com uma sobremesa."),
    },
    Category.COMBOS: {
        Category.DOCES: (0.90, "Que tal uma sobremesa para fechar o combo?"),
        Category.BEBIDAS: (0.70, "Adicione uma bebida extra."),
    },
    Category.SALGADOS: {
        Category.BEBIDAS: (0.95, "Perfeito para acompanhar o salgado."),
        Category.DOCES: (0.75, "Um doce para depois do salgado."),
    },
    Category.BEBIDAS: {
        Category.LANCHES: (0.90, "Escolha um lanche para acompanhar sua bebida."),
        Category.SALGADOS: (0.85, "Vai muito bem com um salgado quentinho."),
        Category.DOCES: (0.70, "Adoce o seu momento."),
    },
    Category.DOCES: {
        Category.BEBIDAS: (0.90, "Um café ou suco para acompanhar o doce."),
    },
}


def determine_ab_group(client_id: str | None) -> str:
    """Assigns client deterministically to control or treatment group."""
    if not client_id:
        return "treatment"
    digest = md5(client_id.encode("utf-8")).hexdigest()
    return "control" if int(digest[:4], 16) % 2 == 0 else "treatment"


def rank_recommendations(
    catalog: list[Product],
    cart_product_ids: list[str],
    past_orders: list[Order],
    current_hour: int,
    limit: int = 3,
    ab_group: str = "treatment",
) -> RecommendationResponse:
    """Ranks available items using basket association rules and time heuristics."""
    if ab_group == "control":
        return RecommendationResponse(
            items=(),
            strategy_used="control_suppressed",
            ab_group="control",
        )

    cart_set = set(cart_product_ids)
    available_products = [p for p in catalog if p.available and p.id not in cart_set]
    if not available_products:
        return RecommendationResponse(
            items=(),
            strategy_used=RecommendationStrategy.POPULAR_FALLBACK,
            ab_group=ab_group,
        )

    cart_products = [p for p in catalog if p.id in cart_set]
    co_occurrences: dict[str, int] = {}
    for order in past_orders:
        order_item_ids = {item.product_id for item in order.items}
        if any(cart_id in order_item_ids for cart_id in cart_set):
            for item in order.items:
                if item.product_id not in cart_set:
                    co_occurrences[item.product_id] = co_occurrences.get(item.product_id, 0) + 1

    scored_candidates: list[RecommendationItem] = []
    strategy = RecommendationStrategy.POPULAR_FALLBACK

    if cart_products:
        strategy = RecommendationStrategy.ASSOCIATION_RULES
        for candidate in available_products:
            best_score = 0.1
            best_reason = "Item sugerido para complementar seu pedido."
            for cart_p in cart_products:
                complements = CATEGORY_COMPLEMENTS.get(cart_p.category, {})
                if candidate.category in complements:
                    score, reason = complements[candidate.category]
                    if score > best_score:
                        best_score = score
                        best_reason = reason
            history_boost = min(0.3, co_occurrences.get(candidate.id, 0) * 0.05)
            total_score = round(best_score + history_boost, 2)
            scored_candidates.append(
                RecommendationItem(
                    product_id=candidate.id,
                    name=candidate.name,
                    price_cents=candidate.price_cents,
                    category=candidate.category,
                    score=total_score,
                    reason=best_reason,
                )
            )
    else:
        strategy = RecommendationStrategy.TIME_OF_DAY
        for candidate in available_products:
            time_score = 0.5
            reason = "Os clientes costumam pedir neste horário."
            if current_hour < 11 and candidate.category in ("salgados", "bebidas"):
                time_score = 0.9
                reason = "Excelente opção para o café da manhã."
            elif 11 <= current_hour < 15 and candidate.category in ("combos", "lanches"):
                time_score = 0.95
                reason = "Mais pedido no horário do almoço."
            elif current_hour >= 15 and candidate.category in ("doces", "bebidas"):
                time_score = 0.85
                reason = "Perfeito para o lanche da tarde."
            scored_candidates.append(
                RecommendationItem(
                    product_id=candidate.id,
                    name=candidate.name,
                    price_cents=candidate.price_cents,
                    category=candidate.category,
                    score=time_score,
                    reason=reason,
                )
            )

    scored_candidates.sort(key=lambda r: (r.score, r.price_cents), reverse=True)
    safe_limit = max(0, limit)
    selected = tuple(scored_candidates[:safe_limit])
    return RecommendationResponse(items=selected, strategy_used=strategy, ab_group=ab_group)
