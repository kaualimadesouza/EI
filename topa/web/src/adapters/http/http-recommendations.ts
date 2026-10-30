import type { RecommendationItem, RecommendationResult } from '../../domain/recommendation'
import type { RecommendationsPort } from '../../ports/recommendations'
import type { HttpClient } from './http-client'

interface WireRecommendationItem {
  product_id: string
  name: string
  price_cents: number
  category: string
  score: number
  reason: string
}

interface WireRecommendationResponse {
  items: WireRecommendationItem[]
  strategy_used: string
  ab_group: string
}

export class HttpRecommendations implements RecommendationsPort {
  private readonly client: HttpClient

  constructor(client: HttpClient) {
    this.client = client
  }

  async getRecommendations(
    storeSlug: string,
    cartProductIds: readonly string[],
    clientId?: string,
  ): Promise<RecommendationResult> {
    const response = await this.client.post(
      `/stores/${encodeURIComponent(storeSlug)}/recommendations`,
      {
        cart_product_ids: cartProductIds,
        client_id: clientId ?? null,
      },
    )

    if (!response.ok) {
      throw new Error(`POST /stores/${storeSlug}/recommendations answered ${response.status}`)
    }

    const data = (await response.json()) as WireRecommendationResponse
    const items: RecommendationItem[] = data.items.map((item) => ({
      productId: item.product_id,
      name: item.name,
      priceCents: item.price_cents,
      category: item.category,
      score: item.score,
      reason: item.reason,
    }))

    return {
      items,
      strategyUsed: data.strategy_used,
      abGroup: data.ab_group,
    }
  }
}
