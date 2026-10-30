import { describe, expect, it } from 'vitest'

import { DEMO_CATALOG } from './demo-catalog'
import { findProduct, type Product } from './menu'
import { bannerFor, SUGGESTION_RULES, suggestionAt, upsellAfterAdding } from './suggest'

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

  it('dynamically offers custom combos at morning, lunch, and desserts in the afternoon', () => {
    const customMenu: Product[] = [
      { id: 'combo-matinal', name: 'Combo Matinal', description: 'Cafe e torrada.', category: 'combos', priceCents: 1500, available: true },
      { id: 'combo-almoco', name: 'Combo Almoco', description: 'Hamburguer e refri.', category: 'combos', priceCents: 2500, available: true },
      { id: 'torta-limao', name: 'Torta de Limao', description: 'Fatia artesanal.', category: 'doces', priceCents: 1200, available: true },
    ]
    expect(suggestionAt(at(8), customMenu).productId).toBe('combo-matinal')
    expect(suggestionAt(at(12), customMenu).productId).toBe('combo-almoco')
    expect(suggestionAt(at(16), customMenu).productId).toBe('torta-limao')

    const genericComboMenu: Product[] = [
      { id: 'combo-generico', name: 'Combo Gen', description: 'Geral', category: 'combos', priceCents: 2000, available: true },
    ]
    expect(suggestionAt(at(12), genericComboMenu).productId).toBe('combo-generico')

    const menuWithoutDesc: Product[] = [
      { id: 'pao', name: 'Pao', description: '', category: 'salgados', priceCents: 300, available: true },
    ]
    expect(suggestionAt(at(8), menuWithoutDesc)).toEqual({ productId: 'pao', reason: 'Para o café da manhã.' })
    expect(suggestionAt(at(12), menuWithoutDesc)).toEqual({ productId: 'pao', reason: 'Combo especial para o almoço.' })
    expect(suggestionAt(at(16), menuWithoutDesc)).toEqual({ productId: 'pao', reason: 'Para acompanhar o café da tarde.' })
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

  it('dynamically offers drinks for custom sandwiches and snacks for custom drinks', () => {
    const customMenu: Product[] = [
      { id: 'sanduba', name: 'Sanduba Natural', description: '', category: 'lanches', priceCents: 1800, available: true },
      { id: 'cha-gelado', name: 'Cha Gelado', description: 'Natural 500ml.', category: 'bebidas', priceCents: 800, available: true },
      { id: 'cafe-expresso', name: 'Cafe Expresso', description: '', category: 'bebidas', priceCents: 600, available: true },
      { id: 'cookie', name: 'Cookie de Chocolate', description: 'Quentinho.', category: 'doces', priceCents: 700, available: true },
    ]
    const sanduba = customMenu[0]
    const upsellDrink = upsellAfterAdding(sanduba, [], customMenu)
    expect(upsellDrink?.productId).toBe('cha-gelado')
    expect(upsellDrink?.question).toBe('Que tal Cha Gelado para acompanhar?')

    const cafe = { ...customMenu[2], id: 'cafe' }
    const upsellSnack = upsellAfterAdding(cafe, [], [cafe, customMenu[3]])
    expect(upsellSnack?.productId).toBe('cookie')
    expect(upsellSnack?.question).toBe('Vai Cookie de Chocolate para acompanhar?')

    const drinkWithoutDesc: Product = { id: 'agua', name: 'Agua', description: '', category: 'bebidas', priceCents: 400, available: true }
    const upsellAgua = upsellAfterAdding(sanduba, [], [sanduba, drinkWithoutDesc])
    expect(upsellAgua?.reason).toBe('Combina com o seu lanche.')

    const noDrinks = upsellAfterAdding(sanduba, [], [sanduba])
    expect(noDrinks).toBeNull()

    const snackWithoutDesc: Product = { id: 'torrada', name: 'Torrada', description: '', category: 'salgados', priceCents: 500, available: true }
    const upsellTorrada = upsellAfterAdding(cafe, [], [cafe, snackWithoutDesc])
    expect(upsellTorrada?.reason).toBe('Para acompanhar sua bebida.')

    const noSnacks = upsellAfterAdding(cafe, [], [cafe])
    expect(noSnacks).toBeNull()
  })
})

describe('SUGGESTION_RULES', () => {
  it('describes every product a rule can offer, and only those', () => {
    const offered = new Set<string>()
    for (const hour of [8, 12, 17]) offered.add(suggestionAt(new Date(2026, 9, 26, hour)).productId)
    const lanche = findProduct(DEMO_CATALOG, 'xsalada')!
    const cafe = findProduct(DEMO_CATALOG, 'cafe')!
    offered.add(upsellAfterAdding(lanche, [], DEMO_CATALOG)!.productId)
    offered.add(upsellAfterAdding(cafe, [], DEMO_CATALOG)!.productId)

    expect(new Set(Object.keys(SUGGESTION_RULES))).toEqual(offered)
  })
})
