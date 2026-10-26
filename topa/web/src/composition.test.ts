import { describe, expect, it } from 'vitest'

import { HttpConnection } from './adapters/http/http-connection'
import { LocalConnection } from './adapters/local/local-connection'
import { createAdapters } from './composition'

describe('createAdapters', () => {
  it('talks to the API when an API URL is configured', () => {
    expect(createAdapters('/api').connection).toBeInstanceOf(HttpConnection)
  })

  it('falls back to demo mode when there is no API URL', () => {
    expect(createAdapters(undefined).connection).toBeInstanceOf(LocalConnection)
  })

  it('treats an empty API URL as no API', () => {
    expect(createAdapters('').connection).toBeInstanceOf(LocalConnection)
  })
})
