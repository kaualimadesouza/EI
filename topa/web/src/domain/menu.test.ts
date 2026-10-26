import { describe, expect, it } from 'vitest'

import { DEMO_CATALOG } from './demo-catalog'
import { CATEGORIES, findProduct, formatBRL } from './menu'
import { displayNumber } from './order'

describe('menu', () => {
  it('formats cents as Brazilian reais', () => {
    expect(formatBRL(1290)).toBe('R$ 12,90')
    expect(formatBRL(310860)).toBe('R$ 3.108,60')
  })

  it('finds a product by id', () => {
    expect(findProduct(DEMO_CATALOG, 'suco')?.name).toBe('Suco de laranja')
    expect(findProduct(DEMO_CATALOG, 'nope')).toBeUndefined()
  })

  it('lists the five categories in menu order, every one with products', () => {
    expect(CATEGORIES.map((c) => c.label)).toEqual(['Combos', 'Lanches', 'Salgados', 'Bebidas', 'Doces'])
    for (const category of CATEGORIES) {
      expect(DEMO_CATALOG.some((p) => p.category === category.id)).toBe(true)
    }
  })

  it('pads order numbers to three digits', () => {
    expect(displayNumber(47)).toBe('047')
    expect(displayNumber(1234)).toBe('1234')
  })
})
