import { afterEach, describe, expect, it, vi } from 'vitest'

import { StoreNotFoundError } from '../../ports/menu'
import { HttpClient } from './http-client'
import { HttpMenu } from './http-menu'

const json = (body: unknown, status = 200) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }))

afterEach(() => vi.restoreAllMocks())

describe('HttpMenu', () => {
  it('loads a store and maps its products to the domain shape', async () => {
    const fetchFn = json({
      store: { slug: 'cantina-central', name: 'Cantina Central' },
      products: [
        { id: 'suco', name: 'Suco de laranja', description: 'Natural, 300 ml.', category: 'bebidas', price_cents: 990, available: false },
      ],
    })

    const menu = await new HttpMenu(new HttpClient('/api')).load('cantina-central')

    expect(fetchFn).toHaveBeenCalledWith('/api/menu?loja=cantina-central', { signal: expect.any(AbortSignal) })
    expect(menu).toEqual({
      store: { slug: 'cantina-central', name: 'Cantina Central' },
      products: [
        { id: 'suco', name: 'Suco de laranja', description: 'Natural, 300 ml.', category: 'bebidas', priceCents: 990, available: false },
      ],
    })
  })

  it('turns an unknown store into StoreNotFoundError', async () => {
    const menu = new HttpMenu(new HttpClient('/api'))

    json({ detail: 'Loja não encontrada.' }, 404)
    await expect(menu.load('padaria-inexistente')).rejects.toEqual(new StoreNotFoundError('Loja não encontrada.'))

    vi.restoreAllMocks()
    json({ detail: [{ msg: 'odd' }] }, 404)
    await expect(menu.load('padaria-inexistente')).rejects.toEqual(new StoreNotFoundError('Loja não encontrada.'))
  })

  it('fails loudly when the API errors', async () => {
    json({}, 500)
    const menu = new HttpMenu(new HttpClient('/api'))

    await expect(menu.load('lanchonete-bem-te-vi')).rejects.toThrow('GET /menu answered 500')
  })

  it('marks a product sold out for that store and returns it in the domain shape', async () => {
    const fetchSpy = json({ id: 'suco', name: 'Suco de laranja', description: 'Natural, 300 ml.', category: 'bebidas', price_cents: 990, available: false })

    const product = await new HttpMenu(new HttpClient('/api')).setAvailability('suco', false, 'cantina-central')

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/products/suco?loja=cantina-central',
      expect.objectContaining({ method: 'PATCH', body: '{"available":false}' }),
    )
    expect(product).toMatchObject({ id: 'suco', priceCents: 990, available: false })
  })

  it('passes auth token from token provider on setAvailability', async () => {
    const fetchSpy = json({
      id: 'suco',
      name: 'Suco',
      description: 'Suco natural.',
      category: 'bebidas',
      price_cents: 990,
      available: false,
    })
    const menu = new HttpMenu(new HttpClient('/api'), () => 'menu-auth-token')

    await menu.setAvailability('suco', false, 'cantina-central')

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/products/suco?loja=cantina-central',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ Authorization: 'Bearer menu-auth-token' }),
      }),
    )
  })

  it('fails loudly when the availability change is refused', async () => {
    json({ detail: 'Produto não encontrado.' }, 404)

    await expect(new HttpMenu(new HttpClient('/api')).setAvailability('gone', true, 'lanchonete-bem-te-vi')).rejects.toThrow(
      'PATCH /products/gone answered 404',
    )
  })

  it('creates a product via POST /products with auth token and returns domain product', async () => {
    const fetchSpy = json({
      id: 'quiche',
      name: 'Quiche',
      description: 'Queijo.',
      category: 'salgados',
      price_cents: 1100,
      photo_url: 'https://example.com/quiche.jpg',
      available: true,
    }, 201)

    const menu = new HttpMenu(new HttpClient('/api'), () => 'auth-token-123')
    const product = await menu.create(
      {
        name: 'Quiche',
        description: 'Queijo.',
        category: 'salgados',
        priceCents: 1100,
        photoUrl: 'https://example.com/quiche.jpg',
      },
      'cantina-central',
    )

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/products?loja=cantina-central',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer auth-token-123' }),
      }),
    )
    expect(product).toEqual({
      id: 'quiche',
      name: 'Quiche',
      description: 'Queijo.',
      category: 'salgados',
      priceCents: 1100,
      photoUrl: 'https://example.com/quiche.jpg',
      available: true,
    })
  })

  it('fails loudly when create product fails', async () => {
    json({}, 500)
    const menu = new HttpMenu(new HttpClient('/api'))

    await expect(
      menu.create(
        { name: 'Quiche', description: '', category: 'salgados', priceCents: 1000 },
        'cantina-central',
      ),
    ).rejects.toThrow('POST /products answered 500')
  })

  it('updates a product via PUT /products/{id} with auth token and returns domain product', async () => {
    const fetchSpy = json({
      id: 'quiche',
      name: 'Quiche de Alho Poro',
      description: 'Especial.',
      category: 'salgados-especiais',
      price_cents: 1200,
      photo_url: null,
      available: true,
    })

    const menu = new HttpMenu(new HttpClient('/api'), () => 'auth-token-123')
    const product = await menu.update(
      'quiche',
      {
        name: 'Quiche de Alho Poro',
        description: 'Especial.',
        category: 'salgados-especiais',
        priceCents: 1200,
        photoUrl: undefined,
        available: true,
      },
      'cantina-central',
    )

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/products/quiche?loja=cantina-central',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ Authorization: 'Bearer auth-token-123' }),
      }),
    )
    expect(product).toEqual({
      id: 'quiche',
      name: 'Quiche de Alho Poro',
      description: 'Especial.',
      category: 'salgados-especiais',
      priceCents: 1200,
      photoUrl: undefined,
      available: true,
    })
  })

  it('fails loudly when update product fails', async () => {
    json({}, 500)
    const menu = new HttpMenu(new HttpClient('/api'))

    await expect(
      menu.update(
        'quiche',
        { name: 'Quiche', description: '', category: 'salgados', priceCents: 1000 },
        'cantina-central',
      ),
    ).rejects.toThrow('PUT /products/quiche answered 500')
  })
})
