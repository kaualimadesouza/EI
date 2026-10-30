import { describe, expect, it } from 'vitest'

import type { Product } from './menu'
import { normalizeText, parseVoiceOrder, stem } from './voice'

const MOCK_CATALOG: Product[] = [
  {
    id: 'misto',
    name: 'Misto Quente',
    description: 'Pão de forma tostado com presunto e queijo.',
    category: 'lanches',
    priceCents: 1200,
    available: true,
  },
  {
    id: 'suco-laranja',
    name: 'Suco de Laranja',
    description: 'Copo de 300 ml feito na hora.',
    category: 'bebidas',
    priceCents: 800,
    available: true,
  },
  {
    id: 'cafe-expresso',
    name: 'Café Expresso',
    description: 'Café moído na hora.',
    category: 'bebidas',
    priceCents: 500,
    available: true,
  },
  {
    id: 'pao-de-queijo',
    name: 'Pão de Queijo',
    description: 'Porção quentinha.',
    category: 'salgados',
    priceCents: 600,
    available: true,
  },
  {
    id: 'milkshake',
    name: 'Milkshake de Morango',
    description: 'Copo de 400 ml.',
    category: 'bebidas',
    priceCents: 1600,
    available: false,
  },
]

describe('voice order domain parsing', () => {
  it('normalizes accents and punctuation', () => {
    expect(normalizeText('Café Expresso, com Açúcar!')).toBe('cafe expresso  com acucar')
  })

  it('handles empty or whitespace only transcript', () => {
    const result = parseVoiceOrder('   ', MOCK_CATALOG)
    expect(result.matchedItems).toHaveLength(0)
    expect(result.unmatchedItems).toHaveLength(0)
    expect(result.totalCents).toBe(0)
    expect(result.allAvailable).toBe(true)
  })

  it('handles transcript with only filler words', () => {
    const result = parseVoiceOrder('oi por favor me da pra mim', MOCK_CATALOG)
    expect(result.matchedItems).toHaveLength(0)
    expect(result.unmatchedItems).toHaveLength(0)
    expect(result.totalCents).toBe(0)
  })

  it('parses single item with text quantity and calculates total', () => {
    const result = parseVoiceOrder('quero dois mistos quentes', MOCK_CATALOG)
    expect(result.matchedItems).toHaveLength(1)
    expect(result.matchedItems[0].productId).toBe('misto')
    expect(result.matchedItems[0].quantity).toBe(2)
    expect(result.matchedItems[0].available).toBe(true)
    expect(result.totalCents).toBe(2400)
    expect(result.allAvailable).toBe(true)
  })

  it('parses numeric digits for quantity', () => {
    const result = parseVoiceOrder('3 sucos de laranja', MOCK_CATALOG)
    expect(result.matchedItems).toHaveLength(1)
    expect(result.matchedItems[0].productId).toBe('suco-laranja')
    expect(result.matchedItems[0].quantity).toBe(3)
    expect(result.totalCents).toBe(2400)
  })

  it('parses item with default quantity 1', () => {
    const result = parseVoiceOrder('cafe expresso', MOCK_CATALOG)
    expect(result.matchedItems).toHaveLength(1)
    expect(result.matchedItems[0].productId).toBe('cafe-expresso')
    expect(result.matchedItems[0].quantity).toBe(1)
  })

  it('parses multiple items in natural speech separated by conjunctions', () => {
    const result = parseVoiceOrder(
      'Gostaria de um misto quente, dois sucos de laranja e tres paes de queijo',
      MOCK_CATALOG,
    )
    expect(result.matchedItems).toHaveLength(3)
    const misto = result.matchedItems.find((i) => i.productId === 'misto')
    const suco = result.matchedItems.find((i) => i.productId === 'suco-laranja')
    const pao = result.matchedItems.find((i) => i.productId === 'pao-de-queijo')

    expect(misto?.quantity).toBe(1)
    expect(suco?.quantity).toBe(2)
    expect(pao?.quantity).toBe(3)
    expect(result.totalCents).toBe(1200 + 2 * 800 + 3 * 600)
  })

  it('aggregates quantities when same item is repeated in speech', () => {
    const result = parseVoiceOrder(
      'um misto quente e mais um misto quente por favor',
      MOCK_CATALOG,
    )
    expect(result.matchedItems).toHaveLength(1)
    expect(result.matchedItems[0].productId).toBe('misto')
    expect(result.matchedItems[0].quantity).toBe(2)
  })

  it('flags items not in catalog as unmatched', () => {
    const result = parseVoiceOrder('quero uma pizza de calabresa e um temaki', MOCK_CATALOG)
    expect(result.matchedItems).toHaveLength(0)
    expect(result.unmatchedItems).toHaveLength(2)
    expect(result.unmatchedItems[0].reason).toContain('não encontrado')
  })

  it('identifies sold out items as unavailable and excludes them from total', () => {
    const result = parseVoiceOrder('um misto quente e dois milkshakes', MOCK_CATALOG)
    expect(result.matchedItems).toHaveLength(2)
    const shake = result.matchedItems.find((i) => i.productId === 'milkshake')
    expect(shake?.available).toBe(false)
    expect(result.allAvailable).toBe(false)
    expect(result.totalCents).toBe(1200)
  })

  it('covers all stem rules and edge cases', () => {
    expect(stem('cha')).toBe('cha')
    expect(stem('porcoes')).toBe('porcao')
    expect(stem('pastais')).toBe('pastel')
    expect(stem('papeis')).toBe('papel')
    expect(stem('sucos')).toBe('suco')
    expect(stem('batata')).toBe('batata')
  })

  it('handles segments with punctuation only or products with empty content tokens', () => {
    const weirdCatalog: Product[] = [
      {
        id: 'empty-name',
        name: 'O A',
        description: 'Apenas artigos.',
        category: 'bebidas',
        priceCents: 100,
        available: true,
      },
    ]
    const result = parseVoiceOrder('misto quente e @ # $ e suco', weirdCatalog)
    expect(result.unmatchedItems).toHaveLength(2)
  })
})
