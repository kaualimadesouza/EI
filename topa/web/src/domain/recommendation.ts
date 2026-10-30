export interface RecommendationItem {
  productId: string
  name: string
  priceCents: number
  category: string
  score: number
  reason: string
}

export interface RecommendationResult {
  items: readonly RecommendationItem[]
  strategyUsed: string
  abGroup: string
}
