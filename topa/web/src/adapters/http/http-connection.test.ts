import { afterEach, describe, expect, it, vi } from 'vitest'

import { HttpClient } from './http-client'
import { HttpConnection } from './http-connection'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('HttpConnection', () => {
  it('asks the readiness endpoint and reports a reachable API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))

    const reachable = await new HttpConnection(new HttpClient('/api')).isReachable()

    expect(fetchSpy).toHaveBeenCalledWith('/api/health/ready', { signal: expect.any(AbortSignal) })
    expect(reachable).toBe(true)
  })

  it('reports an unreachable API when the database is down', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }))

    expect(await new HttpConnection(new HttpClient('/api')).isReachable()).toBe(false)
  })

  it('reports an unreachable API when the request itself fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    expect(await new HttpConnection(new HttpClient('/api')).isReachable()).toBe(false)
  })

  it('gives up on an API that hangs for 3 seconds and reports it unreachable', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    )

    const answer = new HttpConnection(new HttpClient('/api')).isReachable()
    const signal = fetchSpy.mock.calls[0][1]?.signal
    await vi.advanceTimersByTimeAsync(2999)
    expect(signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(signal?.aborted).toBe(true)
    expect(await answer).toBe(false)
  })
})
