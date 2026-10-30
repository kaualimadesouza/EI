import type { Product } from '../../domain/menu'
import type { RecommendationItem, RecommendationResult } from '../../domain/recommendation'
import type { MenuPort } from '../../ports/menu'
import type { RecommendationsPort } from '../../ports/recommendations'

export class LocalRecommendations implements RecommendationsPort {
  private readonly menu: MenuPort

  constructor(menu: MenuPort) {
    this.menu = menu
  }

  async getRecommendations(
    storeSlug: string,
    cartProductIds: readonly string[],
    clientId?: string,
  ): Promise<RecommendationResult> {
    const isControl = clientId?.includes('control') ?? false
    if (isControl) {
      return {
        items: [],
        strategyUsed: 'control_suppressed',
        abGroup: 'control',
      }
    }

    const { products } = await this.menu.load(storeSlug)
    const cartSet = new Set(cartProductIds)
    const available = products.filter((p) => p.available && !cartSet.has(p.id))

    if (available.length === 0) {
      return {
        items: [],
        strategyUsed: 'popular_fallback',
        abGroup: 'treatment',
      }
    }

    const cartProducts = products.filter((p) => cartSet.has(p.id))
    let items: RecommendationItem[] = []
    let strategy = 'popular_fallback'

    if (cartProducts.length > 0) {
      strategy = 'association_rules'
      const hasDrink = cartProducts.some((p) => p.category === 'bebidas')
      const hasDessert = cartProducts.some((p) => p.category === 'doces')

      const scoreProduct = (p: Product) => {
        let score = 0.5
        if (!hasDrink && p.category === 'bebidas') score += 0.4
        if (!hasDessert && p.category === 'doces') score += 0.3
        return score
      }

      const candidates = [...available].sort((a, b) => scoreProduct(b) - scoreProduct(a))

      items = candidates.slice(0, 3).map((p, idx) => ({
        productId: p.id,
        name: p.name,
        priceCents: p.priceCents,
        category: p.category,
        score: Math.max(0.6, 0.95 - idx * 0.1),
        reason: p.category === 'bebidas'
          ? 'Combina com seu pedido para matar a sede.'
          : 'Excelente opção para complementar sua refeição.',
      }))
    } else {
      strategy = 'time_of_day'
      items = available.slice(0, 3).map((p) => ({
        productId: p.id,
        name: p.name,
        priceCents: p.priceCents,
        category: p.category,
        score: 0.9,
        reason: 'Item mais pedido da loja.',
      }))
    }

    return {
      items,
      strategyUsed: strategy,
      abGroup: 'treatment',
    }
  }
}
