import { describe, expect, it } from 'vitest'

import {
  buildNfceQrCodeUrl,
  calculateMod11,
  formatAccessKey,
  generateCustomerFiscalSummary,
  resolveItemTax,
} from './fiscal'
import type { OrderSummary } from './order'

describe('fiscal domain', () => {
  it('calculates mod11 check digit', () => {
    // remainder >= 2
    const key = '3526101234567800019565001000000001199999999'
    const cdv = calculateMod11(key)
    expect(cdv).toBeGreaterThanOrEqual(0)
    expect(cdv).toBeLessThanOrEqual(9)

    // remainder < 2 -> 0
    expect(calculateMod11('0'.repeat(43))).toBe(0)
  })

  it('formats access key in 4-digit groups', () => {
    const raw44 = '35261012345678000195650010000000011999999990'
    const formatted = formatAccessKey(raw44)
    expect(formatted.split(' ')).toHaveLength(11)
    expect(formatted.startsWith('3526 1012')).toBe(true)
  })

  it('resolves item tax by category keywords', () => {
    const drink = resolveItemTax('bebida-1', 'Suco de Maracuja')
    expect(drink.ncm).toBe('22021000')
    expect(drink.rate).toBe(0.25)

    const sweet = resolveItemTax('doce-1', 'Brigadeiro')
    expect(sweet.ncm).toBe('17049090')
    expect(sweet.rate).toBe(0.18)

    const sandwich = resolveItemTax('misto', 'Misto Quente')
    expect(sandwich.ncm).toBe('19059090')
    expect(sandwich.rate).toBe(0.15)
  })

  it('builds SEFAZ QR code URL', () => {
    const url = buildNfceQrCodeUrl('35261012345678000195650010000000011999999990')
    expect(url).toContain('https://www.nfce.fazenda.sp.gov.br/qrcode?p=')
    expect(url).toContain('|2|2|000001|')
  })

  it('generates complete customer fiscal summary', () => {
    const order: OrderSummary = {
      id: 'ord-1',
      number: 42,
      status: 'received',
      dineIn: true,
      paymentMethod: 'card',
      totalCents: 2000,
      createdAt: '2026-10-30T15:00:00Z',
      items: [
        { productId: 'misto', name: 'Misto', quantity: 1, unitPriceCents: 1200 },
        { productId: 'suco', name: 'Suco', quantity: 1, unitPriceCents: 800 },
      ],
    }

    const summary = generateCustomerFiscalSummary(order, { slug: 'bem-te-vi', name: 'Bem-te-vi', cnpj: '12.345.678/0001-95' })
    expect(summary.accessKey).toHaveLength(44)
    expect(summary.storeCnpj).toBe('12345678000195')
    expect(summary.orderNumber).toBe(42)
    expect(summary.items).toHaveLength(2)
    expect(summary.approxTaxCents).toBeGreaterThan(0)

    // Fallback CNPJ when missing
    const summaryFallback = generateCustomerFiscalSummary(order, { slug: 'sem-cnpj', name: 'Sem CNPJ' })
    expect(summaryFallback.storeCnpj).toBe('12345678000195')
  })
})
