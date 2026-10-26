import { describe, expect, it } from 'vitest'

import { HttpConnection } from './adapters/http/http-connection'
import { HttpMenu } from './adapters/http/http-menu'
import { HttpOrders } from './adapters/http/http-orders'
import { LocalConnection } from './adapters/local/local-connection'
import { LocalMenu } from './adapters/local/local-menu'
import { LocalOrders } from './adapters/local/local-orders'
import { createAdapters } from './composition'

describe('createAdapters', () => {
  it('talks to the API when an API URL is configured', () => {
    const adapters = createAdapters('/api')

    expect(adapters.mode).toBe('api')
    expect(adapters.connection).toBeInstanceOf(HttpConnection)
    expect(adapters.menu).toBeInstanceOf(HttpMenu)
    expect(adapters.orders).toBeInstanceOf(HttpOrders)
  })

  it('falls back to demo mode when there is no API URL', () => {
    const adapters = createAdapters(undefined)

    expect(adapters.mode).toBe('demo')
    expect(adapters.connection).toBeInstanceOf(LocalConnection)
    expect(adapters.menu).toBeInstanceOf(LocalMenu)
    expect(adapters.orders).toBeInstanceOf(LocalOrders)
  })

  it('treats an empty API URL as no API', () => {
    const adapters = createAdapters('')

    expect(adapters.mode).toBe('demo')
    expect(adapters.connection).toBeInstanceOf(LocalConnection)
  })
})
