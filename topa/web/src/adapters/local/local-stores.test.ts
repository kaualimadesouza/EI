import { describe, expect, it } from 'vitest'
import { DEFAULT_STORES, LocalStores } from './local-stores'
import { LocalMenu } from './local-menu'

describe('LocalStores', () => {
  it('persists opening and pausing across menu and store adapter instances', async () => {
    const data = new Map<string, string>()
    const storage = { getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value) } }
    const stores = new LocalStores({ storage })
    await expect(stores.setAcceptingOrders('lanchonete-bem-te-vi', false)).resolves.toBe(false)
    expect((await new LocalMenu(storage).load('lanchonete-bem-te-vi')).store.acceptingOrders).toBe(false)
    expect((await new LocalStores({ storage }).listAll())[0].acceptingOrders).toBe(false)
    await expect(stores.setAcceptingOrders('lanchonete-bem-te-vi', true)).resolves.toBe(true)
  })

  it('refuses opening when every product is sold out and refuses unknown stores', async () => {
    const data = new Map<string, string>()
    const storage = { getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value) } }
    const menu = new LocalMenu(storage)
    for (const product of (await menu.load('lanchonete-bem-te-vi')).products) {
      await menu.setAvailability(product.id, false, 'lanchonete-bem-te-vi')
    }
    const stores = new LocalStores({ storage })
    await expect(stores.setAcceptingOrders('lanchonete-bem-te-vi', true)).rejects.toThrow('produto à venda')
    await expect(stores.setAcceptingOrders('unknown', false)).rejects.toThrow('Loja não encontrada.')
    await expect(new LocalStores({ storage: null }).setAcceptingOrders('lanchonete-bem-te-vi', false)).resolves.toBe(false)
  })
  it('returns default stores when initialized without options', async () => {
    const storesAdapter = new LocalStores()
    const result = await storesAdapter.listAll()
    expect(result).toEqual(DEFAULT_STORES)
  })

  it('returns custom stores when provided in options', async () => {
    const customStores = [{ slug: 'custom-store', name: 'Custom Store' }]
    const storesAdapter = new LocalStores({ stores: customStores })
    const result = await storesAdapter.listAll()
    expect(result).toEqual(customStores)
  })
})
