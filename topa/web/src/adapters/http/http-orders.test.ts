import { afterEach, describe, expect, it, vi } from 'vitest'

import { OrderRejectedError } from '../../ports/orders'
import { HttpClient } from './http-client'
import { HttpOrders } from './http-orders'

const json = (body: unknown, status = 200) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }))

const draft = {
  lines: [{ productId: 'misto', quantity: 2 }],
  dineIn: false,
  paymentMethod: 'pix' as const,
  placedOn: 'phone' as const,
}

const order = (id: string, status: string) => ({
  id,
  number: 3,
  status,
  dine_in: false,
  payment_method: 'pix',
  total_cents: 990,
  created_at: '2026-10-26T15:00:00Z',
  items: [],
})

const placed = { id: 'o3', number: 3, totalCents: 990, businessDate: '2026-10-26' }

afterEach(() => vi.restoreAllMocks())

describe('HttpOrders', () => {
  it('posts the order in the API shape and returns its number and total', async () => {
    const fetchFn = json({ ...order('o47', 'received'), number: 47, total_cents: 2980 }, 201)

    const placed = await new HttpOrders(new HttpClient('/api')).place(draft)

    expect(fetchFn).toHaveBeenCalledWith('/api/orders', expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse(fetchFn.mock.calls[0][1]!.body as string)).toEqual({
      items: [{ product_id: 'misto', quantity: 2 }],
      dine_in: false,
      payment_method: 'pix',
    })
    // the API does not record where an order was placed yet, so it is not sent
    expect(placed).toEqual({ id: 'o47', number: 47, totalCents: 2980, businessDate: '2026-10-26' })
  })

  it('turns a refusal into the message the API wrote for the customer', async () => {
    json({ detail: 'Coxinha esgotou.' }, 409)
    const orders = new HttpOrders(new HttpClient('/api'))

    await expect(orders.place(draft)).rejects.toEqual(new OrderRejectedError('Coxinha esgotou.'))
  })

  it('uses a generic message when the refusal is a validation list', async () => {
    json({ detail: [{ msg: 'bad' }] }, 422)
    const orders = new HttpOrders(new HttpClient('/api'))

    await expect(orders.place(draft)).rejects.toEqual(
      new OrderRejectedError('Não foi possível registrar o pedido.'),
    )
  })

  it('fails loudly on a server error', async () => {
    json({}, 500)
    const orders = new HttpOrders(new HttpClient('/api'))

    await expect(orders.place(draft)).rejects.toThrow('POST /orders answered 500')
  })

  it('lists one day of orders in the domain shape', async () => {
    const fetchSpy = json([
      {
        id: 'o1',
        number: 3,
        status: 'preparing',
        dine_in: true,
        payment_method: 'card',
        total_cents: 2290,
        created_at: '2026-10-26T15:00:00Z',
        items: [{ product_id: 'xsalada', name: 'X-salada', quantity: 1, unit_price_cents: 2290 }],
      },
    ])

    const orders = await new HttpOrders(new HttpClient('/api')).list('2026-10-26')

    expect(fetchSpy).toHaveBeenCalledWith('/api/orders?date=2026-10-26', { signal: expect.any(AbortSignal) })
    expect(orders).toEqual([
      {
        id: 'o1',
        number: 3,
        status: 'preparing',
        dineIn: true,
        paymentMethod: 'card',
        totalCents: 2290,
        createdAt: '2026-10-26T15:00:00Z',
        items: [{ productId: 'xsalada', name: 'X-salada', quantity: 1, unitPriceCents: 2290 }],
      },
    ])
  })

  it('fails loudly when the day cannot be listed', async () => {
    json({}, 500)

    await expect(new HttpOrders(new HttpClient('/api')).list('2026-10-26')).rejects.toThrow('GET /orders answered 500')
  })

  it('moves an order and returns it as the API now has it', async () => {
    const fetchSpy = json({
      id: 'o1',
      number: 3,
      status: 'ready',
      dine_in: false,
      payment_method: 'pix',
      total_cents: 990,
      created_at: '2026-10-26T15:00:00Z',
      items: [],
    })

    const order = await new HttpOrders(new HttpClient('/api')).setStatus('o1', 'ready')

    expect(fetchSpy).toHaveBeenCalledWith('/api/orders/o1', expect.objectContaining({ method: 'PATCH', body: '{"status":"ready"}' }))
    expect(order).toMatchObject({ id: 'o1', status: 'ready', dineIn: false })
  })

  it('passes on the API words when a move is refused or the order is gone', async () => {
    const orders = new HttpOrders(new HttpClient('/api'))

    json({ detail: 'O pedido 003 não pode passar de recebido para entregue.' }, 409)
    await expect(orders.setStatus('o1', 'delivered')).rejects.toEqual(
      new OrderRejectedError('O pedido 003 não pode passar de recebido para entregue.'),
    )
    vi.restoreAllMocks()
    json({ detail: [{ msg: 'odd' }] }, 404)
    await expect(orders.setStatus('o1', 'ready')).rejects.toEqual(new OrderRejectedError('Não foi possível mudar o pedido.'))
  })

  it('fails loudly on any other error while moving an order', async () => {
    json({}, 500)

    await expect(new HttpOrders(new HttpClient('/api')).setStatus('o1', 'ready')).rejects.toThrow(
      'PATCH /orders/o1 answered 500',
    )
  })

  it('follows a placed order through its business day until the API says it is ready', async () => {
    const orders = new HttpOrders(new HttpClient('/api'))

    const preparing = json([order('o1', 'ready'), order('o3', 'preparing')])
    expect(await orders.statusOf(placed)).toBe('preparing')
    expect(preparing).toHaveBeenCalledWith('/api/orders?date=2026-10-26', { signal: expect.any(AbortSignal) })
    vi.restoreAllMocks()
    json([order('o3', 'ready')])
    expect(await orders.statusOf(placed)).toBe('ready')
  })

  it('says the order is not found when its day no longer lists it', async () => {
    json([order('o1', 'ready')])

    await expect(new HttpOrders(new HttpClient('/api')).statusOf(placed)).rejects.toEqual(
      new OrderRejectedError('Pedido não encontrado.'),
    )
  })

  it('fails loudly when the order cannot be followed', async () => {
    json({}, 500)

    await expect(new HttpOrders(new HttpClient('/api')).statusOf(placed)).rejects.toThrow('GET /orders answered 500')
  })
})
