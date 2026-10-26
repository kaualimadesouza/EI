import { describe, expect, it } from 'vitest'

import { DEMO_CATALOG } from './demo-catalog'
import { findProduct, type Product } from './menu'
import { bannerFor, suggestionAt, upsellAfterAdding } from './suggest'

const at = (hour: number) => new Date(2026, 9, 26, hour, 30)
const product = (id: string): Product => findProduct(DEMO_CATALOG, id)!
const soldOut = (id: string) =>
  DEMO_CATALOG.map((p) => (p.id === id ? { ...p, available: false } : p))

describe('suggestionAt', () => {
  it('offers the coffee combo in the morning, the sandwich combo at lunch, cake later', () => {
    expect(suggestionAt(at(8)).productId).toBe('combo-cafe')
    expect(suggestionAt(at(12)).productId).toBe('combo-misto')
    expect(suggestionAt(at(16))).toEqual({ productId: 'bolo', reason: 'Para acompanhar o café da tarde.' })
  })
})

describe('bannerFor', () => {
  it('shows the suggestion on another category', () => {
    expect(bannerFor(at(8), 'lanches', [], DEMO_CATALOG)?.productId).toBe('combo-cafe')
  })

  it('hides on the category that already shows the item as a card', () => {
    expect(bannerFor(at(8), 'combos', [], DEMO_CATALOG)).toBeNull()
  })

  it('hides once the item is in the cart', () => {
    const lines = [{ productId: 'combo-cafe', quantity: 1 }]

    expect(bannerFor(at(8), 'lanches', lines, DEMO_CATALOG)).toBeNull()
  })

  it('hides when the item sold out', () => {
    expect(bannerFor(at(8), 'lanches', [], soldOut('combo-cafe'))).toBeNull()
  })
})

describe('upsellAfterAdding', () => {
  it('offers orange juice after a sandwich when there is no drink yet', () => {
    const lines = [{ productId: 'misto', quantity: 1 }]

    expect(upsellAfterAdding(product('misto'), lines, DEMO_CATALOG)?.productId).toBe('suco')
  })

  it('offers nothing after a sandwich when a drink or the sandwich combo is in the cart', () => {
    const withDrink = [
      { productId: 'refri', quantity: 1 },
      { productId: 'misto', quantity: 1 },
    ]
    const withCombo = [
      { productId: 'combo-misto', quantity: 1 },
      { productId: 'bauru', quantity: 1 },
    ]

    expect(upsellAfterAdding(product('misto'), withDrink, DEMO_CATALOG)).toBeNull()
    expect(upsellAfterAdding(product('bauru'), withCombo, DEMO_CATALOG)).toBeNull()
  })

  it('offers pão de queijo after a coffee unless a snack or the coffee combo is there', () => {
    const alone = [{ productId: 'cafe', quantity: 1 }]
    const withSnack = [...alone, { productId: 'coxinha', quantity: 1 }]
    const withCombo = [...alone, { productId: 'combo-cafe', quantity: 1 }]

    expect(upsellAfterAdding(product('cafe'), alone, DEMO_CATALOG)).toEqual({
      productId: 'paoqueijo',
      question: 'Vai um pão de queijo com o café?',
      reason: 'Porção com três unidades.',
    })
    expect(upsellAfterAdding(product('cafe'), withSnack, DEMO_CATALOG)).toBeNull()
    expect(upsellAfterAdding(product('cafe'), withCombo, DEMO_CATALOG)).toBeNull()
  })

  it('offers nothing for other products', () => {
    const lines = [{ productId: 'bolo', quantity: 1 }]

    expect(upsellAfterAdding(product('bolo'), lines, DEMO_CATALOG)).toBeNull()
  })

  it('never offers a sold-out product', () => {
    const lines = [{ productId: 'misto', quantity: 1 }]

    expect(upsellAfterAdding(product('misto'), lines, soldOut('suco'))).toBeNull()
  })

  it('ignores cart lines whose product left the catalog', () => {
    const lines = [
      { productId: 'gone', quantity: 1 },
      { productId: 'misto', quantity: 1 },
    ]

    expect(upsellAfterAdding(product('misto'), lines, DEMO_CATALOG)?.productId).toBe('suco')
  })
})
