import { afterEach, describe, expect, it, vi } from 'vitest'

import { HttpClient } from './http-client'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('HttpClient', () => {
  it('prefixes GET paths with the base URL and a timeout signal', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]'))

    await new HttpClient('/api').get('/products')

    expect(fetchSpy).toHaveBeenCalledWith('/api/products', {
      signal: expect.any(AbortSignal),
    })
  })

  it('posts JSON with a timeout signal', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))

    await new HttpClient('/api').post('/orders', { dine_in: true })

    expect(fetchSpy).toHaveBeenCalledWith('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"dine_in":true}',
      signal: expect.any(AbortSignal),
    })
  })

  it('patches JSON with a timeout signal', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))

    await new HttpClient('/api').patch('/products/suco', { available: false })

    expect(fetchSpy).toHaveBeenCalledWith('/api/products/suco', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{"available":false}',
      signal: expect.any(AbortSignal),
    })
  })

  it('puts JSON with a timeout signal', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))

    await new HttpClient('/api').put('/products/suco', { name: 'Suco Natural' })

    expect(fetchSpy).toHaveBeenCalledWith('/api/products/suco', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name":"Suco Natural"}',
      signal: expect.any(AbortSignal),
    })
  })

  it('attaches bearer token when set on client', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]'))
    const client = new HttpClient('/api')
    client.setToken('test-token-123')
    expect(client.getToken()).toBe('test-token-123')

    await client.get('/orders')
    expect(fetchSpy).toHaveBeenCalledWith('/api/orders', {
      headers: { Authorization: 'Bearer test-token-123' },
      signal: expect.any(AbortSignal),
    })

    await client.patch('/orders/o1', { status: 'preparing' })
    expect(fetchSpy).toHaveBeenCalledWith('/api/orders/o1', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token-123',
      },
      body: '{"status":"preparing"}',
      signal: expect.any(AbortSignal),
    })

    await client.post('/orders', { dine_in: true })
    expect(fetchSpy).toHaveBeenCalledWith('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token-123',
      },
      body: '{"dine_in":true}',
      signal: expect.any(AbortSignal),
    })
  })

  it('allows overriding token explicitly per request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]'))
    const client = new HttpClient('/api', 'default-token')

    await client.get('/orders', 10_000, 'override-token')
    expect(fetchSpy).toHaveBeenCalledWith('/api/orders', {
      headers: { Authorization: 'Bearer override-token' },
      signal: expect.any(AbortSignal),
    })

    await client.patch('/orders/o1', { status: 'ready' }, 'override-patch-token')
    expect(fetchSpy).toHaveBeenCalledWith('/api/orders/o1', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer override-patch-token',
      },
      body: '{"status":"ready"}',
      signal: expect.any(AbortSignal),
    })

    await client.post('/orders', { dine_in: true }, 'override-post-token')
    expect(fetchSpy).toHaveBeenCalledWith('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer override-post-token',
      },
      body: '{"dine_in":true}',
      signal: expect.any(AbortSignal),
    })
  })

  it('aborts a request that hangs for 10 seconds so payment cannot lock the kiosk forever', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    )

    const request = new HttpClient('/api').post('/orders', { dine_in: true })
    const caught = request.catch((error: unknown) => error)
    const signal = fetchSpy.mock.calls[0][1]?.signal
    await vi.advanceTimersByTimeAsync(9999)
    expect(signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(signal?.aborted).toBe(true)
    expect(await caught).toBeInstanceOf(DOMException)
  })
})
