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
}

afterEach(() => vi.restoreAllMocks())

describe('HttpOrders', () => {
  it('posts the order in the API shape and returns its number and total', async () => {
    const fetchFn = json({ number: 47, total_cents: 2980, status: 'received' }, 201)

    const placed = await new HttpOrders(new HttpClient('/api')).place(draft)

    expect(fetchFn).toHaveBeenCalledWith('/api/orders', expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse(fetchFn.mock.calls[0][1]!.body as string)).toEqual({
      items: [{ product_id: 'misto', quantity: 2 }],
      dine_in: false,
      payment_method: 'pix',
    })
    expect(placed).toEqual({ number: 47, totalCents: 2980 })
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
})
