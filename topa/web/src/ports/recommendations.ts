import type { RecommendationResult } from '../domain/recommendation'

export interface RecommendationsPort {
  getRecommendations(
    storeSlug: string,
    cartProductIds: readonly string[],
    clientId?: string,
  ): Promise<RecommendationResult>
}
