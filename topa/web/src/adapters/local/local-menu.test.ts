import { describe, expect, it } from 'vitest'

import { DEMO_CATALOG } from '../../domain/demo-catalog'
import { LocalMenu } from './local-menu'

describe('LocalMenu', () => {
  it('serves the demo catalog as copies, so callers cannot mutate it', async () => {
    const products = await new LocalMenu().list()
    products[0].available = false

    expect(products).toHaveLength(18)
    expect(DEMO_CATALOG[0].available).toBe(true)
  })
})
