import { describe, expect, it } from 'vitest'

import { LocalConnection } from './local-connection'

describe('LocalConnection', () => {
  it('is always reachable, since the demo store lives in this browser', async () => {
    expect(await new LocalConnection().isReachable()).toBe(true)
  })
})
