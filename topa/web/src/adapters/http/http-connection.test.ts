import { afterEach, describe, expect, it, vi } from 'vitest'

import { HttpClient } from './http-client'
import { HttpConnection } from './http-connection'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('HttpConnection', () => {
  it('asks the readiness endpoint and reports a reachable API on first attempt', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))

    const reachable = await new HttpConnection(new HttpClient('/api')).isReachable()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledWith('/api/health/ready', { signal: expect.any(AbortSignal) })
    expect(reachable).toBe(true)
  })

  it('retries once and succeeds when the first attempt returns a non-ok status', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const reachable = await new HttpConnection(new HttpClient('/api')).isReachable()

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(reachable).toBe(true)
  })

  it('retries once and succeeds when the first attempt rejects', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const reachable = await new HttpConnection(new HttpClient('/api')).isReachable()

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(reachable).toBe(true)
  })

  it('reports an unreachable API when both attempts return a non-ok status', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }))

    const reachable = await new HttpConnection(new HttpClient('/api')).isReachable()

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(reachable).toBe(false)
  })

  it('reports an unreachable API when both attempts fail with a network error', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    const reachable = await new HttpConnection(new HttpClient('/api')).isReachable()

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(reachable).toBe(false)
  })

  it('recovers when the first call hangs for 6 seconds and the retry succeeds', async () => {
    vi.useFakeTimers()
    let calls = 0
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      calls++
      if (calls === 1) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        })
      }
      return Promise.resolve(new Response('{}', { status: 200 }))
    })

    const answer = new HttpConnection(new HttpClient('/api')).isReachable()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(6000)

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(await answer).toBe(true)
  })

  it('gives up on an API that hangs for 6 seconds twice and reports it unreachable', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    )

    const answer = new HttpConnection(new HttpClient('/api')).isReachable()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const firstSignal = fetchSpy.mock.calls[0][1]?.signal
    await vi.advanceTimersByTimeAsync(5999)
    expect(firstSignal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(firstSignal?.aborted).toBe(true)

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    const secondSignal = fetchSpy.mock.calls[1][1]?.signal
    await vi.advanceTimersByTimeAsync(5999)
    expect(secondSignal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(secondSignal?.aborted).toBe(true)

    expect(await answer).toBe(false)
  })
})
