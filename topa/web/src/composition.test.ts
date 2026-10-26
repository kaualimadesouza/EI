import { describe, expect, it } from 'vitest'

import { HttpConnection } from './adapters/http/http-connection'
import { LocalConnection } from './adapters/local/local-connection'
import { createAdapters } from './composition'

describe('createAdapters', () => {
  it('talks to the API when an API URL is configured', () => {
    const adapters = createAdapters('/api')

    expect(adapters.mode).toBe('api')
    expect(adapters.connection).toBeInstanceOf(HttpConnection)
  })

  it('falls back to demo mode when there is no API URL', () => {
    const adapters = createAdapters(undefined)

    expect(adapters.mode).toBe('demo')
    expect(adapters.connection).toBeInstanceOf(LocalConnection)
  })

  it('treats an empty API URL as no API', () => {
    const adapters = createAdapters('')

    expect(adapters.mode).toBe('demo')
    expect(adapters.connection).toBeInstanceOf(LocalConnection)
  })
})
