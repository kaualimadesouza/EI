import { describe, expect, it } from 'vitest'

import { buildCustomerEscPos, buildKitchenEscPos, decodeEscPos } from './escpos'
import type { OrderSummary } from './order'

describe('escpos domain', () => {
  const sampleOrder: OrderSummary = {
    id: 'ord-10',
    number: 10,
    status: 'preparing',
    dineIn: true,
    paymentMethod: 'pix',
    totalCents: 1500,
    createdAt: '2026-10-30T14:30:00Z',
    items: [{ productId: 'coxinha', name: 'Coxinha de Frango', quantity: 2, unitPriceCents: 750 }],
  }

  it('builds kitchen esc/pos ticket and decodes properly', () => {
    const bytes = buildKitchenEscPos(sampleOrder, 'Bem-te-vi')
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(20)

    const lines = decodeEscPos(bytes)
    expect(lines.some((l) => l.text.includes('PEDIDO #10'))).toBe(true)
    expect(lines.some((l) => l.text.includes('NO LOCAL'))).toBe(true)
    expect(lines.some((l) => l.text.includes('2x  Coxinha de Frango'))).toBe(true)
    expect(lines.some((l) => l.isCut)).toBe(true)

    // Take out
    const takeOutBytes = buildKitchenEscPos({ ...sampleOrder, dineIn: false }, 'Bem-te-vi')
    const takeOutLines = decodeEscPos(takeOutBytes)
    expect(takeOutLines.some((l) => l.text.includes('PARA LEVAR'))).toBe(true)
  })

  it('builds customer esc/pos receipt with and without fiscal key', () => {
    // With fiscal key
    const bytesWithFiscal = buildCustomerEscPos(sampleOrder, 'Bem-te-vi', '3526 1012 3456 ...')
    const linesWith = decodeEscPos(bytesWithFiscal)
    expect(linesWith.some((l) => l.text.includes('DOCUMENTO AUXILIAR'))).toBe(true)
    expect(linesWith.some((l) => l.text.includes('3526 1012 3456 ...'))).toBe(true)

    // Without fiscal key
    const bytesPlain = buildCustomerEscPos({ ...sampleOrder, dineIn: false }, 'Bem-te-vi')
    const linesPlain = decodeEscPos(bytesPlain)
    expect(linesPlain.some((l) => l.text.includes('PARA LEVAR'))).toBe(true)
    expect(linesPlain.some((l) => l.text.includes('CHAVE DE ACESSO'))).toBe(false)
  })

  it('handles alignment and style transitions in decodeEscPos', () => {
    const raw = new Uint8Array([
      0x1b, 0x40, // init
      0x1b, 0x61, 0x01, // center
      0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x0a, // Hello\n
      0x1b, 0x61, 0x02, // right
      0x1b, 0x45, 0x01, // bold on
      0x57, 0x6f, 0x72, 0x6c, 0x64, 0x0a, // World\n
      0x1b, 0x61, 0x00, // left
      0x1b, 0x45, 0x00, // bold off
      0x1d, 0x21, 0x11, // double size
      0x42, 0x69, 0x67, 0x0a, // Big\n
      0x1d, 0x21, 0x00, // double size off
      0x1b, 0x64, 0x02, // feed 2 lines
      0x0d, 0x0a, // carriage return followed by newline (empty text)
      0x1d, 0x56, 0x42, 0x00, // cut
    ])

    const lines = decodeEscPos(raw)
    expect(lines.find((l) => l.text === 'Hello')?.align).toBe('center')
    const worldLine = lines.find((l) => l.text === 'World')
    expect(worldLine?.align).toBe('right')
    expect(worldLine?.bold).toBe(true)
    const bigLine = lines.find((l) => l.text === 'Big')
    expect(bigLine?.doubleSize).toBe(true)
    expect(lines.some((l) => l.isCut)).toBe(true)
  })
})
