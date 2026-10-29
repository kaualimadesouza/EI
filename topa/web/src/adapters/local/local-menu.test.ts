import { describe, expect, it } from 'vitest'

import { DEMO_CATALOG } from '../../domain/demo-catalog'
import { DEMO_STORE_SLUG } from '../../domain/store'
import { StoreNotFoundError } from '../../ports/menu'
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
  it('serves the demo store and its catalog as copies, so callers cannot mutate it', async () => {
    const { store, products } = await new LocalMenu(new MemoryStorage()).load(DEMO_STORE_SLUG)
    products[0].available = false

    expect(store).toEqual({ slug: 'lanchonete-bem-te-vi', name: 'Lanchonete Bem-te-vi' })
    expect(products).toHaveLength(18)
    expect(DEMO_CATALOG[0].available).toBe(true)
  })

  it('remembers a sold-out product for every tab on the same storage, until it is back', async () => {
    const storage = new MemoryStorage()

    const soldOut = await new LocalMenu(storage).setAvailability('coxinha', false, DEMO_STORE_SLUG)
    const { products: seenByAnotherTab } = await new LocalMenu(storage).load(DEMO_STORE_SLUG)

    expect(soldOut).toMatchObject({ id: 'coxinha', available: false })
    expect(seenByAnotherTab.find((p) => p.id === 'coxinha')?.available).toBe(false)
    expect(seenByAnotherTab.filter((p) => !p.available)).toHaveLength(1)

    await new LocalMenu(storage).setAvailability('coxinha', true, DEMO_STORE_SLUG)

    expect((await new LocalMenu(storage).load(DEMO_STORE_SLUG)).products.every((p) => p.available)).toBe(true)
  })

  it('refuses an unknown store with StoreNotFoundError', async () => {
    const menu = new LocalMenu(new MemoryStorage())

    await expect(menu.load('outra-loja')).rejects.toEqual(new StoreNotFoundError('Loja não encontrada.'))
    await expect(menu.setAvailability('coxinha', false, 'outra-loja')).rejects.toEqual(
      new StoreNotFoundError('Loja não encontrada.'),
    )
  })

  it('refuses a product the catalog does not have', async () => {
    await expect(new LocalMenu(new MemoryStorage()).setAvailability('gone', false, DEMO_STORE_SLUG)).rejects.toThrow(
      'No product gone',
    )
  })

  it('uses the browser storage by default', async () => {
    localStorage.clear()

    await new LocalMenu().setAvailability('suco', false, DEMO_STORE_SLUG)

    expect(JSON.parse(localStorage.getItem('topa.sold-out')!)).toEqual(['suco'])
  })
})
