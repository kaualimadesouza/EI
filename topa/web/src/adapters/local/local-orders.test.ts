import { describe, expect, it } from 'vitest'

import { DEMO_STORE_SLUG } from '../../domain/store'
import { StoreNotFoundError } from '../../ports/menu'
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
  storeSlug: DEMO_STORE_SLUG,
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
  it('numbers orders per store and day and prices them from the menu', async () => {
    const { storage, menu } = store()

    const first = await new LocalOrders(menu, storage, monday).place(draft)
    const second = await new LocalOrders(menu, storage, monday).place(draft)
    const nextDay = await new LocalOrders(menu, storage, tuesday).place(draft)

    expect(first).toEqual({ id: expect.any(String), number: 1, totalCents: 2 * 1490 + 990 })
    expect(second.number).toBe(2)
    expect(nextDay.number).toBe(1)
  })

  it('returns existing order idempotently when same clientOrderId is placed again', async () => {
    const { orders } = store()
    const first = await orders.place(draft, 'idempotent-local-key')
    const second = await orders.place(draft, 'idempotent-local-key')

    expect(first.id).toBe(second.id)
    expect(first.number).toBe(second.number)
    const list = await orders.list('2026-10-26', DEMO_STORE_SLUG)
    expect(list.length).toBe(1)
  })

  it('lists one day of orders for that store only', async () => {
    const { orders } = store()
    await orders.place(draft)

    const [order] = await orders.list('2026-10-26', DEMO_STORE_SLUG)

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
    expect(await orders.list('2026-10-27', DEMO_STORE_SLUG)).toEqual([])
  })

  it('refuses to list an unknown store, as the API answers 404', async () => {
    const { orders } = store()

    await expect(orders.list('2026-10-26', 'outra-loja')).rejects.toBeInstanceOf(StoreNotFoundError)
  })

  it('refuses an unknown store, a missing product or a sold-out product, like the API', async () => {
    const { orders, menu } = store()
    await menu.setAvailability('suco', false, DEMO_STORE_SLUG)

    await expect(orders.place({ ...draft, storeSlug: 'outra-loja' })).rejects.toEqual(
      new OrderRejectedError('Loja não encontrada.'),
    )
    await expect(orders.place({ ...draft, lines: [{ productId: 'gone', quantity: 1 }] })).rejects.toEqual(
      new OrderRejectedError('Um dos produtos não está mais no cardápio.'),
    )
    await expect(orders.place(draft)).rejects.toEqual(new OrderRejectedError('Suco de laranja esgotou.'))
    expect(await orders.list('2026-10-26', DEMO_STORE_SLUG)).toEqual([])
  })

  it('rethrows unexpected menu failures untouched', async () => {
    const brokenMenu = {
      load: () => Promise.reject(new Error('storage offline')),
      setAvailability: () => Promise.reject(new Error('storage offline')),
      create: () => Promise.reject(new Error('storage offline')),
      update: () => Promise.reject(new Error('storage offline')),
    }
    const orders = new LocalOrders(brokenMenu, new MemoryStorage(), monday)

    await expect(orders.place(draft)).rejects.toThrow('storage offline')
  })

  it('moves one order a step at a time, back for an undo, and leaves the others alone', async () => {
    const { orders, storage, menu } = store()
    await orders.place(draft)
    await orders.place(draft)
    const [order] = await orders.list('2026-10-26', DEMO_STORE_SLUG)

    const preparing = await orders.setStatus(order.id, 'preparing')
    await orders.setStatus(order.id, 'received')
    await orders.setStatus(order.id, 'preparing')

    expect(preparing.status).toBe('preparing')
    const reread = await new LocalOrders(menu, storage, monday).list('2026-10-26', DEMO_STORE_SLUG)
    expect(reread.map((o) => [o.number, o.status])).toEqual([
      [1, 'preparing'],
      [2, 'received'],
    ])
  })

  it('refuses a jump and an unknown order with the messages the API uses', async () => {
    const { orders } = store()
    await orders.place(draft)
    const [order] = await orders.list('2026-10-26', DEMO_STORE_SLUG)

    await expect(orders.setStatus(order.id, 'delivered')).rejects.toEqual(
      new OrderRejectedError('O pedido 001 não pode passar de recebido para entregue.'),
    )
    await expect(orders.setStatus('nope', 'preparing')).rejects.toEqual(new OrderRejectedError('Pedido não encontrado.'))
  })

  it('keeps numbering orders sequentially when storage fills up after the first order', async () => {
    const storage = new MemoryStorage()
    const menu = new LocalMenu(storage)
    let full = false
    const quotaStorage = {
      getItem: (key: string) => storage.getItem(key),
      setItem: (key: string, value: string) => {
        if (full) throw new Error('QuotaExceededError')
        storage.setItem(key, value)
      },
    }
    const orders = new LocalOrders(menu, quotaStorage, monday)

    const first = await orders.place(draft)
    full = true
    const second = await orders.place(draft)
    const third = await orders.place(draft)

    expect([first.number, second.number, third.number]).toEqual([1, 2, 3])
  })

  it('tells the phone where its order is, and runs the demo kitchen: ready 5 s after it was placed', async () => {
    const { storage, menu, orders } = store()
    const { id } = await orders.place(draft)
    await orders.place(draft)
    const later = (ms: number) => new LocalOrders(menu, storage, () => new Date(monday().getTime() + ms))

    expect(await later(4_999).statusOf(id)).toBe('received')
    expect(await later(5_000).statusOf(id)).toBe('ready')
    const dashboard = await later(5_000).list('2026-10-26', DEMO_STORE_SLUG)
    expect(dashboard.map((o) => [o.number, o.status])).toEqual([
      [1, 'ready'],
      [2, 'received'],
    ])
  })

  it('cooks only an order a phone follows: on the dashboard alone it waits for the merchant', async () => {
    const { storage, menu, orders } = store()
    await orders.place(draft)

    const anHourLater = new LocalOrders(menu, storage, () => new Date(monday().getTime() + 3_600_000))

    expect((await anHourLater.list('2026-10-26', DEMO_STORE_SLUG))[0].status).toBe('received')
  })

  it('leaves an order the merchant already started to the merchant', async () => {
    const { storage, menu, orders } = store()
    const { id } = await orders.place(draft)
    await orders.setStatus(id, 'preparing')

    expect(await new LocalOrders(menu, storage, () => new Date(monday().getTime() + 60_000)).statusOf(id)).toBe('preparing')
  })

  it('fails when asked about an order this browser does not hold', async () => {
    const { orders } = store()

    await expect(orders.statusOf('gone')).rejects.toThrow('order gone is not in this browser')
  })

  it('uses the browser storage and clock by default', async () => {
    localStorage.clear()

    const placed = await new LocalOrders(new LocalMenu()).place(draft)

    expect(placed.number).toBe(1)
    expect(JSON.parse(localStorage.getItem('topa.orders.v3')!)).toHaveLength(1)
  })

  it('lists customer orders newest first across stores', async () => {
    const { storage, menu } = store()
    const orders = new LocalOrders(menu, storage, monday)
    await orders.place(draft)
    const secondOrders = new LocalOrders(menu, storage, tuesday)
    await secondOrders.place({ ...draft, storeSlug: 'brasa-burgers' })

    const customerOrders = await orders.listCustomerOrders()
    expect(customerOrders).toHaveLength(2)
    expect(customerOrders[0].storeSlug).toBe('brasa-burgers')
    expect(customerOrders[1].storeSlug).toBe(DEMO_STORE_SLUG)
  })
})
