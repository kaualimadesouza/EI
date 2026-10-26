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
