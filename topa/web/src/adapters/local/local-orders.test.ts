import { describe, expect, it } from 'vitest'

import { OrderRejectedError } from '../../ports/orders'
import { LocalMenu } from './local-menu'
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
    { productId: 'misto', quantity: 2 },
    { productId: 'suco', quantity: 1 },
  ],
  dineIn: false,
  paymentMethod: 'card' as const,
}
const monday = () => new Date(2026, 9, 26, 12, 0)
const tuesday = () => new Date(2026, 9, 27, 8, 0)

function store(now = monday) {
  const storage = new MemoryStorage()
  const menu = new LocalMenu(storage)
  return { storage, menu, orders: new LocalOrders(menu, storage, now) }
}

describe('LocalOrders', () => {
  it('numbers orders per day and prices them from the menu', async () => {
    const { storage, menu } = store()

    const first = await new LocalOrders(menu, storage, monday).place(draft)
    const second = await new LocalOrders(menu, storage, monday).place(draft)
    const nextDay = await new LocalOrders(menu, storage, tuesday).place(draft)

    expect(first).toEqual({ number: 1, totalCents: 2 * 1490 + 990 })
    expect(second.number).toBe(2)
    expect(nextDay.number).toBe(1)
  })

  it('lists one day of orders the way the dashboard reads them', async () => {
    const { orders } = store()
    await orders.place(draft)

    const [order] = await orders.list('2026-10-26')

    expect(order).toMatchObject({
      number: 1,
      status: 'received',
      dineIn: false,
      paymentMethod: 'card',
      totalCents: 3970,
      createdAt: monday().toISOString(),
      items: [
        { productId: 'misto', name: 'Misto quente', quantity: 2, unitPriceCents: 1490 },
        { productId: 'suco', name: 'Suco de laranja', quantity: 1, unitPriceCents: 990 },
      ],
    })
    expect(order.id).toEqual(expect.any(String))
    expect(await orders.list('2026-10-27')).toEqual([])
  })

  it('refuses a product that left the menu or sold out, like the API', async () => {
    const { orders, menu } = store()
    await menu.setAvailability('suco', false)

    await expect(orders.place({ ...draft, lines: [{ productId: 'gone', quantity: 1 }] })).rejects.toEqual(
      new OrderRejectedError('Um dos produtos não está mais no cardápio.'),
    )
    await expect(orders.place(draft)).rejects.toEqual(new OrderRejectedError('Suco de laranja esgotou.'))
    expect(await orders.list('2026-10-26')).toEqual([])
  })

  it('moves one order a step at a time, back for an undo, and leaves the others alone', async () => {
    const { orders, storage, menu } = store()
    await orders.place(draft)
    await orders.place(draft)
    const [order] = await orders.list('2026-10-26')

    const preparing = await orders.setStatus(order.id, 'preparing')
    await orders.setStatus(order.id, 'received')
    await orders.setStatus(order.id, 'preparing')

    expect(preparing.status).toBe('preparing')
    const reread = await new LocalOrders(menu, storage, monday).list('2026-10-26')
    expect(reread.map((o) => [o.number, o.status])).toEqual([
      [1, 'preparing'],
      [2, 'received'],
    ])
  })

  it('refuses a jump and an unknown order with the messages the API uses', async () => {
    const { orders } = store()
    await orders.place(draft)
    const [order] = await orders.list('2026-10-26')

    await expect(orders.setStatus(order.id, 'delivered')).rejects.toEqual(
      new OrderRejectedError('O pedido 001 não pode passar de recebido para entregue.'),
    )
    await expect(orders.setStatus('nope', 'preparing')).rejects.toEqual(new OrderRejectedError('Pedido não encontrado.'))
  })

  it('uses the browser storage and clock by default', async () => {
    localStorage.clear()

    const placed = await new LocalOrders(new LocalMenu()).place(draft)

    expect(placed.number).toBe(1)
    expect(JSON.parse(localStorage.getItem('topa.orders.v2')!)).toHaveLength(1)
  })
})
