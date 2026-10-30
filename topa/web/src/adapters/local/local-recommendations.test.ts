import { describe, expect, it } from 'vitest'

import type { Product } from '../../domain/menu'
import type { StoreMenu } from '../../domain/store'
import type { MenuPort } from '../../ports/menu'
import { LocalRecommendations } from './local-recommendations'

const SAMPLE_PRODUCTS: Product[] = [
  {
    id: 'burger',
    name: 'Burger',
    description: 'Artesanal.',
    category: 'lanches',
    priceCents: 3000,
    available: true,
  },
  {
    id: 'suco',
    name: 'Suco',
    description: 'Natural.',
    category: 'bebidas',
    priceCents: 800,
    available: true,
  },
  {
    id: 'brownie',
    name: 'Brownie',
    description: 'Doce.',
    category: 'doces',
    priceCents: 1200,
    available: true,
  },
  {
    id: 'sold-out-shake',
    name: 'Shake',
    description: 'Cremoso.',
    category: 'bebidas',
    priceCents: 1500,
    available: false,
  },
]

function makeMenuPort(products: Product[] = SAMPLE_PRODUCTS): MenuPort {
  return {
    load: (slug: string): Promise<StoreMenu> =>
      Promise.resolve({
        store: { slug, name: 'Loja Teste' },
        products,
      }),
    create: () => Promise.reject(new Error('not implemented')),
    update: () => Promise.reject(new Error('not implemented')),
    setAvailability: () => Promise.reject(new Error('not implemented')),
  }
}

describe('LocalRecommendations', () => {
  it('suppresses recommendations for control group', async () => {
    const adapter = new LocalRecommendations(makeMenuPort())
    const res = await adapter.getRecommendations('loja', ['burger'], 'user-control-1')

    expect(res).toEqual({
      items: [],
      strategyUsed: 'control_suppressed',
      abGroup: 'control',
    })
  })

  it('recommends beverage and dessert for cart with burger', async () => {
    const adapter = new LocalRecommendations(makeMenuPort())
    const res = await adapter.getRecommendations('loja', ['burger'])

    expect(res.strategyUsed).toBe('association_rules')
    expect(res.abGroup).toBe('treatment')
    expect(res.items.length).toBeGreaterThan(0)
    expect(res.items[0].category).toBe('bebidas')
  })

  it('handles cart with already selected beverage and dessert', async () => {
    const adapter = new LocalRecommendations(makeMenuPort())
    const res = await adapter.getRecommendations('loja', ['suco', 'brownie'])

    expect(res.strategyUsed).toBe('association_rules')
    expect(res.items.length).toBe(1)
    expect(res.items[0].productId).toBe('burger')
  })

  it('handles cart with dessert only and recommends beverage', async () => {
    const adapter = new LocalRecommendations(makeMenuPort())
    const res = await adapter.getRecommendations('loja', ['brownie'])

    expect(res.strategyUsed).toBe('association_rules')
    expect(res.items.length).toBeGreaterThan(0)
    expect(res.items[0].category).toBe('bebidas')
  })

  it('recommends time of day items for empty cart', async () => {
    const adapter = new LocalRecommendations(makeMenuPort())
    const res = await adapter.getRecommendations('loja', [])

    expect(res.strategyUsed).toBe('time_of_day')
    expect(res.abGroup).toBe('treatment')
    expect(res.items.length).toBe(3)
  })

  it('returns empty fallback when no products are available', async () => {
    const adapter = new LocalRecommendations(makeMenuPort([]))
    const res = await adapter.getRecommendations('loja', [])

    expect(res).toEqual({
      items: [],
      strategyUsed: 'popular_fallback',
      abGroup: 'treatment',
    })
  })
})
