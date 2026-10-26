import { describe, expect, it } from 'vitest'

import { DEMO_CATALOG } from '../../domain/demo-catalog'
import { LocalMenu } from './local-menu'

class MemoryStorage {
  data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

describe('LocalMenu', () => {
  it('serves the demo catalog as copies, so callers cannot mutate it', async () => {
    const products = await new LocalMenu(new MemoryStorage()).list()
    products[0].available = false

    expect(products).toHaveLength(18)
    expect(DEMO_CATALOG[0].available).toBe(true)
  })

  it('remembers a sold-out product for every tab on the same storage, until it is back', async () => {
    const storage = new MemoryStorage()

    const soldOut = await new LocalMenu(storage).setAvailability('coxinha', false)
    const seenByAnotherTab = await new LocalMenu(storage).list()

    expect(soldOut).toMatchObject({ id: 'coxinha', available: false })
    expect(seenByAnotherTab.find((p) => p.id === 'coxinha')?.available).toBe(false)
    expect(seenByAnotherTab.filter((p) => !p.available)).toHaveLength(1)

    await new LocalMenu(storage).setAvailability('coxinha', true)

    expect((await new LocalMenu(storage).list()).every((p) => p.available)).toBe(true)
  })

  it('refuses a product the catalog does not have', async () => {
    await expect(new LocalMenu(new MemoryStorage()).setAvailability('gone', false)).rejects.toThrow('No product gone')
  })

  it('uses the browser storage by default', async () => {
    localStorage.clear()

    await new LocalMenu().setAvailability('suco', false)

    expect(JSON.parse(localStorage.getItem('topa.sold-out')!)).toEqual(['suco'])
  })
})
