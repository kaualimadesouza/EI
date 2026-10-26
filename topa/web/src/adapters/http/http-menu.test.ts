import { afterEach, describe, expect, it, vi } from 'vitest'

import { HttpClient } from './http-client'
import { HttpMenu } from './http-menu'

const json = (body: unknown, status = 200) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }))

afterEach(() => vi.restoreAllMocks())

describe('HttpMenu', () => {
  it('reads the products and maps them to the domain shape', async () => {
    const fetchFn = json([
      { id: 'suco', name: 'Suco de laranja', description: 'Natural, 300 ml.', category: 'bebidas', price_cents: 990, available: false },
    ])

    const products = await new HttpMenu(new HttpClient('/api')).list()

    expect(fetchFn).toHaveBeenCalledWith('/api/products')
    expect(products).toEqual([
      { id: 'suco', name: 'Suco de laranja', description: 'Natural, 300 ml.', category: 'bebidas', priceCents: 990, available: false },
    ])
  })

  it('fails loudly when the API errors', async () => {
    json({}, 500)
    const menu = new HttpMenu(new HttpClient('/api'))

    await expect(menu.list()).rejects.toThrow('GET /products answered 500')
  })

  it('marks a product sold out and returns it in the domain shape', async () => {
    const fetchSpy = json({ id: 'suco', name: 'Suco de laranja', description: 'Natural, 300 ml.', category: 'bebidas', price_cents: 990, available: false })

    const product = await new HttpMenu(new HttpClient('/api')).setAvailability('suco', false)

    expect(fetchSpy).toHaveBeenCalledWith('/api/products/suco', expect.objectContaining({ method: 'PATCH', body: '{"available":false}' }))
    expect(product).toMatchObject({ id: 'suco', priceCents: 990, available: false })
  })

  it('fails loudly when the availability change is refused', async () => {
    json({ detail: 'Produto não encontrado.' }, 404)

    await expect(new HttpMenu(new HttpClient('/api')).setAvailability('gone', true)).rejects.toThrow(
      'PATCH /products/gone answered 404',
    )
  })
})
