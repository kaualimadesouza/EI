import { describe, expect, it, vi } from 'vitest'

import { buildKitchenEscPos } from '../../domain/escpos'
import type { OrderSummary } from '../../domain/order'
import { WebPrinterAdapter } from './web-printer'

describe('WebPrinterAdapter', () => {
  const sampleOrder: OrderSummary = {
    id: 'ord-1',
    number: 1,
    status: 'received',
    dineIn: true,
    paymentMethod: 'pix',
    totalCents: 1000,
    createdAt: '2026-10-30T10:00:00Z',
    items: [{ productId: 'suco', name: 'Suco', quantity: 1, unitPriceCents: 1000 }],
  }

  it('reports supported and logs formatted receipt info to console', async () => {
    const adapter = new WebPrinterAdapter()
    expect(adapter.isSupported()).toBe(true)

    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const bytes = buildKitchenEscPos(sampleOrder, 'Loja Teste')
    await adapter.print(bytes)

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ESC/POS Print Output:'))
    consoleSpy.mockRestore()
  })
})
