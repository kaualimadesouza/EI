import { describe, expect, it } from 'vitest'

import { DEMO_CATALOG } from './demo-catalog'
import { addOne, itemCount, quantityOf, removeOne, totalCents } from './cart'

describe('cart', () => {
  it('adds a new line, then raises its quantity on the next add', () => {
    const once = addOne([], 'misto')
    const twice = addOne(once, 'misto')

    expect(once).toEqual([{ productId: 'misto', quantity: 1 }])
    expect(twice).toEqual([{ productId: 'misto', quantity: 2 }])
  })

  it('keeps other lines untouched when adding', () => {
    const lines = addOne(addOne([], 'misto'), 'suco')

    expect(addOne(lines, 'suco')).toEqual([
      { productId: 'misto', quantity: 1 },
      { productId: 'suco', quantity: 2 },
    ])
  })

  it('drops the line when its last unit is removed', () => {
    const lines = [
      { productId: 'misto', quantity: 2 },
      { productId: 'suco', quantity: 1 },
    ]

    expect(removeOne(lines, 'misto')).toEqual([
      { productId: 'misto', quantity: 1 },
      { productId: 'suco', quantity: 1 },
    ])
    expect(removeOne(lines, 'suco')).toEqual([{ productId: 'misto', quantity: 2 }])
  })

  it('counts units and reads one product quantity', () => {
    const lines = [
      { productId: 'misto', quantity: 2 },
      { productId: 'suco', quantity: 1 },
    ]

    expect(itemCount(lines)).toBe(3)
    expect(quantityOf(lines, 'misto')).toBe(2)
    expect(quantityOf(lines, 'bolo')).toBe(0)
  })

  it('totals with catalog prices and ignores a product missing from the catalog', () => {
    const lines = [
      { productId: 'misto', quantity: 2 },
      { productId: 'suco', quantity: 1 },
      { productId: 'gone', quantity: 5 },
    ]

    expect(totalCents(lines, DEMO_CATALOG)).toBe(2 * 1490 + 990)
  })
})
