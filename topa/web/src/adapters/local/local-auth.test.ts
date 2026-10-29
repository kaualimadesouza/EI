import { describe, expect, it } from 'vitest'

import { AuthError } from '../../ports/auth'
import type { KeyValueStore } from './browser-storage'
import { LocalAuth } from './local-auth'

class MemoryStorage implements KeyValueStore {
  data = new Map<string, string>()

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

describe('LocalAuth', () => {
  it('initializes empty by default when storage is null', () => {
    const auth = new LocalAuth({ storage: null })

    expect(auth.getToken()).toBeNull()
    expect(auth.getMerchant()).toBeNull()
  })

  it('accepts initial merchant and token in options', () => {
    const auth = new LocalAuth({
      storage: null,
      initialMerchant: { email: 'admin@bemtevi.topa.com', storeSlug: 'bem-te-vi' },
      initialToken: 'initial-token',
    })

    expect(auth.getToken()).toBe('initial-token')
    expect(auth.getMerchant()).toEqual({
      email: 'admin@bemtevi.topa.com',
      storeSlug: 'bem-te-vi',
    })
  })

  it('restores session from storage when not passed initial merchant', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      'topa_demo_merchant_session',
      JSON.stringify({
        token: 'stored-demo-token',
        merchant: { email: 'admin@bemtevi.topa.com', storeSlug: 'bem-te-vi' },
      }),
    )

    const auth = new LocalAuth({ storage })

    expect(auth.getToken()).toBe('stored-demo-token')
    expect(auth.getMerchant()).toEqual({
      email: 'admin@bemtevi.topa.com',
      storeSlug: 'bem-te-vi',
    })
  })

  it('ignores corrupted or invalid session in storage', () => {
    const storage = new MemoryStorage()
    storage.setItem('topa_demo_merchant_session', 'broken-json')

    const auth = new LocalAuth({ storage })

    expect(auth.getToken()).toBeNull()
    expect(auth.getMerchant()).toBeNull()
  })

  it('authenticates with default credentials and persists session', async () => {
    const storage = new MemoryStorage()
    const auth = new LocalAuth({ storage })

    const merchant = await auth.login({
      email: 'admin@bemtevi.topa.com',
      password: 'topa123',
    })

    expect(merchant).toEqual({
      email: 'admin@bemtevi.topa.com',
      storeSlug: 'lanchonete-bem-te-vi',
    })
    expect(auth.getToken()).toBe('demo-token-lanchonete-bem-te-vi')
    expect(auth.getMerchant()).toEqual(merchant)
    expect(storage.getItem('topa_demo_merchant_session')).toContain('demo-token-lanchonete-bem-te-vi')
  })

  it('supports custom accounts configuration', async () => {
    const auth = new LocalAuth({
      storage: null,
      accounts: [{ email: 'custom@store.com', password: 'secret', storeSlug: 'custom-store' }],
    })

    const merchant = await auth.login({
      email: 'custom@store.com',
      password: 'secret',
    })

    expect(merchant.storeSlug).toBe('custom-store')
    expect(auth.getToken()).toBe('demo-token-custom-store')
  })

  it('throws AuthError when credentials do not match', async () => {
    const auth = new LocalAuth({ storage: null })

    await expect(
      auth.login({ email: 'admin@bemtevi.topa.com', password: 'wrong' }),
    ).rejects.toThrow(AuthError)
    await expect(
      auth.login({ email: 'unknown@store.com', password: 'topa123' }),
    ).rejects.toThrow('E-mail ou senha incorretos.')
  })

  it('clears token, merchant and storage on logout', async () => {
    const storage = new MemoryStorage()
    const auth = new LocalAuth({ storage })

    await auth.login({ email: 'admin@bemtevi.topa.com', password: 'topa123' })
    expect(auth.getToken()).not.toBeNull()

    auth.logout()

    expect(auth.getToken()).toBeNull()
    expect(auth.getMerchant()).toBeNull()
    expect(storage.getItem('topa_demo_merchant_session')).toBe('')
  })

  it('handles faulty storage on persist and clear without throwing', async () => {
    const faultyStorage: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('storage quota')
      },
    }

    const auth = new LocalAuth({ storage: faultyStorage })
    await expect(
      auth.login({ email: 'admin@bemtevi.topa.com', password: 'topa123' }),
    ).resolves.toBeDefined()
    expect(() => auth.logout()).not.toThrow()
  })

  it('supports logout when storage is null', () => {
    const auth = new LocalAuth({ storage: null })
    expect(() => auth.logout()).not.toThrow()
  })
})
