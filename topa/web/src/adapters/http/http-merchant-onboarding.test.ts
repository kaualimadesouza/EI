import { afterEach, describe, expect, it, vi } from 'vitest'

import { HttpAuth } from './http-auth'
import { HttpClient } from './http-client'
import { HttpStores } from './http-stores'

afterEach(() => vi.unstubAllGlobals())

describe('merchant onboarding over HTTP', () => {
  it('shows a Portuguese recovery action when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(
      new HttpStores(new HttpClient('https://api.example')).setAcceptingOrders('loja', false),
    ).rejects.toThrow('Não foi possível alterar o recebimento de pedidos. Tente de novo.')
    await expect(
      new HttpAuth(new HttpClient('https://api.example'), null).login({
        email: 'a@example.com',
        password: 'senha',
      }),
    ).rejects.toThrow('Não foi possível conectar ao TOPA. Verifique sua conexão e tente de novo.')
  })
  it('registers a store and persists the owner session for a reload', async () => {
    const storage = new Map<string, string>()
    const keyValue = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
    }
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'owner-token',
          store_slug: 'restaurante-123',
          email: 'dono@example.com',
        }),
        { status: 201 },
      ),
    )
    vi.stubGlobal('fetch', fetcher)
    const client = new HttpClient('https://api.example')
    const auth = new HttpAuth(client, keyValue)
    await auth.register({ storeName: 'Restaurante', email: 'dono@example.com', password: 'senha1234' })
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example/auth/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ store_name: 'Restaurante', email: 'dono@example.com', password: 'senha1234' }),
      }),
    )
    expect(new HttpAuth(new HttpClient('https://api.example'), keyValue).getMerchant()).toEqual({
      email: 'dono@example.com',
      storeSlug: 'restaurante-123',
    })
  })

  it.each([undefined, () => 'owner-token'])('changes ordering with the merchant token: %s', async (token) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ accepting_orders: false })))
    vi.stubGlobal('fetch', fetcher)
    const stores = new HttpStores(new HttpClient('https://api.example', 'fallback-token'), token)
    await expect(stores.setAcceptingOrders('minha-loja', false)).resolves.toBe(false)
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example/stores/minha-loja/ordering',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          Authorization: `Bearer ${token ? 'owner-token' : 'fallback-token'}`,
        }),
        body: JSON.stringify({ accepting_orders: false }),
      }),
    )
  })

  it.each([JSON.stringify({ detail: 'Cadastre um produto antes de abrir.' }), 'unavailable', '{}'])(
    'explains a failed opening without reporting success: %s',
    async (body) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 422 })))
      await expect(
        new HttpStores(new HttpClient('https://api.example')).setAcceptingOrders('loja', true),
      ).rejects.toThrow(
        body.includes('detail')
          ? 'Cadastre um produto antes de abrir.'
          : 'Não foi possível alterar o recebimento de pedidos. Tente de novo.',
      )
    },
  )
})
