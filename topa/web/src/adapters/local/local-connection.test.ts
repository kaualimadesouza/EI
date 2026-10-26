import { describe, expect, it } from 'vitest'

import { LocalConnection } from './local-connection'

describe('LocalConnection', () => {
  it('always answers in demo mode, since the store lives in this browser', async () => {
    expect(await new LocalConnection().check()).toEqual({ mode: 'demo', reachable: true })
  })
})
