import { describe, expect, it } from 'vitest'

import { OrderRejectedError } from '../../ports/orders'
import { LocalOrders } from './local-orders'

class MemoryStorage {
  data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

const draft = {
  lines: [
    { productId: 'misto', quantity: 1 },
    { productId: 'suco', quantity: 1 },
  ],
  dineIn: true,
  paymentMethod: 'card' as const,
}
const monday = () => new Date(2026, 9, 26, 12, 0)
const tuesday = () => new Date(2026, 9, 27, 8, 0)

describe('LocalOrders', () => {
  it('numbers orders per day, prices them from the catalog and keeps them in storage', async () => {
    const storage = new MemoryStorage()

    const first = await new LocalOrders(storage, monday).place(draft)
    const second = await new LocalOrders(storage, monday).place(draft)
    const nextDay = await new LocalOrders(storage, tuesday).place(draft)

    expect(first).toEqual({ number: 1, totalCents: 1490 + 990 })
    expect(second.number).toBe(2)
    expect(nextDay.number).toBe(1)
    expect(new LocalOrders(storage).all().map((o) => [o.businessDate, o.number, o.status])).toEqual([
      ['2026-10-26', 1, 'received'],
      ['2026-10-26', 2, 'received'],
      ['2026-10-27', 1, 'received'],
    ])
  })

  it('refuses an order with a product that is not on the menu', async () => {
    const orders = new LocalOrders(new MemoryStorage(), monday)

    await expect(
      orders.place({ ...draft, lines: [{ productId: 'gone', quantity: 1 }] }),
    ).rejects.toEqual(new OrderRejectedError('Um item do pedido saiu do cardápio.'))
  })

  it('keeps selling from memory when storage is missing', async () => {
    const orders = new LocalOrders(null, monday)

    await orders.place(draft)

    expect((await orders.place(draft)).number).toBe(2)
  })

  it('keeps selling from memory when storage throws', async () => {
    const broken = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    const orders = new LocalOrders(broken, monday)

    await orders.place(draft)

    expect((await orders.place(draft)).number).toBe(2)
  })

  it('uses the browser storage and clock by default', async () => {
    localStorage.clear()

    const placed = await new LocalOrders().place(draft)

    expect(placed.number).toBe(1)
    expect(JSON.parse(localStorage.getItem('topa.orders')!)).toHaveLength(1)
  })

  it('falls back to memory when reading localStorage itself throws', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError')
      },
    })
    try {
      const orders = new LocalOrders()
      await orders.place(draft)

      expect(orders.all()).toHaveLength(1)
    } finally {
      Object.defineProperty(globalThis, 'localStorage', original)
    }
  })
})
