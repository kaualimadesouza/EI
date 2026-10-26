import { describe, expect, it, vi } from 'vitest'

import { HttpConnection } from './http-connection'

describe('HttpConnection', () => {
  it('asks the readiness endpoint and reports a reachable API', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }))

    const connection = await new HttpConnection('/api', fetchFn).check()

    expect(fetchFn).toHaveBeenCalledWith('/api/health/ready')
    expect(connection).toEqual({ mode: 'api', reachable: true })
  })

  it('reports an unreachable API when the database is down', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 503 }))

    const connection = await new HttpConnection('/api', fetchFn).check()

    expect(connection).toEqual({ mode: 'api', reachable: false })
  })

  it('reports an unreachable API when the request itself fails', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))

    const connection = await new HttpConnection('/api', fetchFn).check()

    expect(connection).toEqual({ mode: 'api', reachable: false })
  })

  it('calls the global fetch when no fetch is injected', async () => {
    const globalFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }))

    const connection = await new HttpConnection('http://localhost:8010').check()

    expect(globalFetch).toHaveBeenCalledWith('http://localhost:8010/health/ready', undefined)
    expect(connection).toEqual({ mode: 'api', reachable: true })
    globalFetch.mockRestore()
  })
})
