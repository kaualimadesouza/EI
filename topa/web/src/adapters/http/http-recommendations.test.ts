import { afterEach, describe, expect, it, vi } from 'vitest'

import { HttpClient } from './http-client'
import { HttpRecommendations } from './http-recommendations'

const json = (body: unknown, status = 200) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }))

afterEach(() => vi.restoreAllMocks())

describe('HttpRecommendations', () => {
  it('posts request with cart and clientId and parses wire response', async () => {
    const fetchFn = json({
      items: [
        {
          product_id: 'coca',
          name: 'Refrigerante',
          price_cents: 800,
          category: 'bebidas',
          score: 0.95,
          reason: 'Combina com seu lanche.',
        },
      ],
      strategy_used: 'association_rules',
      ab_group: 'treatment',
    })

    const adapter = new HttpRecommendations(new HttpClient('/api'))
    const result = await adapter.getRecommendations('brasa-burgers', ['burger'], 'user-123')

    expect(fetchFn).toHaveBeenCalledWith(
      '/api/stores/brasa-burgers/recommendations',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          cart_product_ids: ['burger'],
          client_id: 'user-123',
        }),
      }),
    )

    expect(result).toEqual({
      items: [
        {
          productId: 'coca',
          name: 'Refrigerante',
          priceCents: 800,
          category: 'bebidas',
          score: 0.95,
          reason: 'Combina com seu lanche.',
        },
      ],
      strategyUsed: 'association_rules',
      abGroup: 'treatment',
    })
  })

  it('throws an error when response is not ok', async () => {
    json({ detail: 'Loja não encontrada.' }, 404)

    const adapter = new HttpRecommendations(new HttpClient('/api'))
    await expect(
      adapter.getRecommendations('inexistente', []),
    ).rejects.toThrow('POST /stores/inexistente/recommendations answered 404')
  })
})
