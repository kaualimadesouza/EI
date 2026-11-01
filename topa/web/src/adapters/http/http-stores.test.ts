import { describe, expect, it, vi } from 'vitest'
import { HttpStores } from './http-stores'
import type { HttpClient } from './http-client'

describe('HttpStores', () => {
  it('lists all stores from GET /stores', async () => {
    const fakeClient = {
      get: vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { slug: 'brasa-burgers', name: 'Brasa Burgers', segment: 'restaurant' },
          { slug: 'emporio-campus', name: 'Empório Campus', segment: 'market' },
        ],
      }),
    }

    const storesAdapter = new HttpStores(fakeClient as unknown as HttpClient)
    const result = await storesAdapter.listAll()

    expect(fakeClient.get).toHaveBeenCalledWith('/stores', undefined, null)
    expect(result).toEqual([
      { slug: 'brasa-burgers', name: 'Brasa Burgers', segment: 'restaurant' },
      { slug: 'emporio-campus', name: 'Empório Campus', segment: 'market' },
    ])
  })

  it('throws an error when GET /stores fails', async () => {
    const fakeClient = {
      get: vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      }),
    }

    const storesAdapter = new HttpStores(fakeClient as unknown as HttpClient)
    await expect(storesAdapter.listAll()).rejects.toThrow('GET /stores answered 500')
  })
})
