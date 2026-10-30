import { describe, expect, it } from 'vitest'
import { DEFAULT_STORES, LocalStores } from './local-stores'

describe('LocalStores', () => {
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
