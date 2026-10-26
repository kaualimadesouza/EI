import { afterEach, describe, expect, it, vi } from 'vitest'

import { HttpClient } from './http-client'

afterEach(() => vi.restoreAllMocks())

describe('HttpClient', () => {
  it('prefixes GET paths with the base URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]'))

    await new HttpClient('/api').get('/products')

    expect(fetchSpy).toHaveBeenCalledWith('/api/products')
  })

  it('posts JSON', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))

    await new HttpClient('/api').post('/orders', { dine_in: true })

    expect(fetchSpy).toHaveBeenCalledWith('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"dine_in":true}',
    })
  })
})
