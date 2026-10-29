import { describe, expect, it, vi } from 'vitest'

import { AuthError } from '../../ports/auth'
import type { KeyValueStore } from '../local/browser-storage'
import { HttpAuth } from './http-auth'
import { HttpClient } from './http-client'

class MemoryStorage implements KeyValueStore {
  data = new Map<string, string>()

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

describe('HttpAuth', () => {
  it('initializes with null token and merchant when storage is empty', () => {
    const client = new HttpClient('http://test')
    const auth = new HttpAuth(client, null)

    expect(auth.getToken()).toBeNull()
    expect(auth.getMerchant()).toBeNull()
  })

  it('restores stored session on construction', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      'topa_merchant_session',
      JSON.stringify({
        token: 'saved-token',
        merchant: { email: 'admin@bemtevi.topa.com', storeSlug: 'bem-te-vi' },
      }),
    )

    const client = new HttpClient('http://test')
    const auth = new HttpAuth(client, storage)

    expect(auth.getToken()).toBe('saved-token')
    expect(auth.getMerchant()).toEqual({
      email: 'admin@bemtevi.topa.com',
      storeSlug: 'bem-te-vi',
    })
    expect(client.getToken()).toBe('saved-token')
  })

  it('ignores corrupted or invalid session in storage', () => {
    const storage = new MemoryStorage()
    storage.setItem('topa_merchant_session', 'invalid-json')

    const client = new HttpClient('http://test')
    const auth = new HttpAuth(client, storage)

    expect(auth.getToken()).toBeNull()
    expect(auth.getMerchant()).toBeNull()
  })

  it('ignores stored session with missing fields', () => {
    const storage = new MemoryStorage()
    storage.setItem('topa_merchant_session', JSON.stringify({ token: 123 }))

    const client = new HttpClient('http://test')
    const auth = new HttpAuth(client, storage)

    expect(auth.getToken()).toBeNull()
    expect(auth.getMerchant()).toBeNull()
  })

  it('authenticates merchant and saves session', async () => {
    const storage = new MemoryStorage()
    const client = new HttpClient('http://test')
    vi.spyOn(client, 'post').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'jwt-token-123',
          token_type: 'bearer',
          store_slug: 'lanchonete-bem-te-vi',
          email: 'admin@bemtevi.topa.com',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const auth = new HttpAuth(client, storage)
    const result = await auth.login({
      email: 'admin@bemtevi.topa.com',
      password: 'topa123',
    })

    expect(result).toEqual({
      email: 'admin@bemtevi.topa.com',
      storeSlug: 'lanchonete-bem-te-vi',
    })
    expect(auth.getToken()).toBe('jwt-token-123')
    expect(auth.getMerchant()).toEqual({
      email: 'admin@bemtevi.topa.com',
      storeSlug: 'lanchonete-bem-te-vi',
    })
    expect(client.getToken()).toBe('jwt-token-123')
    expect(storage.getItem('topa_merchant_session')).toContain('jwt-token-123')
  })

  it('throws AuthError with message from server on 401 response', async () => {
    const client = new HttpClient('http://test')
    vi.spyOn(client, 'post').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ detail: 'E-mail ou senha inválidos' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const auth = new HttpAuth(client, null)
    await expect(
      auth.login({ email: 'admin@bemtevi.topa.com', password: 'wrong' }),
    ).rejects.toThrow(AuthError)
    await expect(
      auth.login({ email: 'admin@bemtevi.topa.com', password: 'wrong' }),
    ).rejects.toThrow('E-mail ou senha inválidos')
  })

  it('throws AuthError with fallback message when response is not JSON', async () => {
    const client = new HttpClient('http://test')
    vi.spyOn(client, 'post').mockImplementation(() =>
      Promise.resolve(new Response('Internal Server Error', { status: 500 })),
    )

    const auth = new HttpAuth(client, null)
    await expect(
      auth.login({ email: 'admin@bemtevi.topa.com', password: 'wrong' }),
    ).rejects.toThrow('E-mail ou senha incorretos.')
  })

  it('clears token, merchant and storage on logout', async () => {
    const storage = new MemoryStorage()
    const client = new HttpClient('http://test')
    vi.spyOn(client, 'post').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'token-abc',
          token_type: 'bearer',
          store_slug: 'lanchonete-bem-te-vi',
          email: 'admin@bemtevi.topa.com',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const auth = new HttpAuth(client, storage)
    await auth.login({ email: 'admin@bemtevi.topa.com', password: 'topa123' })
    expect(auth.getToken()).toBe('token-abc')

    auth.logout()
    expect(auth.getToken()).toBeNull()
    expect(auth.getMerchant()).toBeNull()
    expect(client.getToken()).toBeNull()
    expect(storage.getItem('topa_merchant_session')).toBe('')
  })

  it('handles storage errors gracefully', async () => {
    const faultyStorage: KeyValueStore = {
      getItem: () => {
        throw new Error('read error')
      },
      setItem: () => {
        throw new Error('write error')
      },
    }

    const client = new HttpClient('http://test')
    vi.spyOn(client, 'post').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'token-xyz',
          token_type: 'bearer',
          store_slug: 'bem-te-vi',
          email: 'admin@bemtevi.topa.com',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const auth = new HttpAuth(client, faultyStorage)
    await expect(
      auth.login({ email: 'admin@bemtevi.topa.com', password: 'topa123' }),
    ).resolves.toBeDefined()
    expect(() => auth.logout()).not.toThrow()
  })

  it('works with null storage during login and logout', async () => {
    const client = new HttpClient('http://test')
    vi.spyOn(client, 'post').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'token-null-storage',
          token_type: 'bearer',
          store_slug: 'bem-te-vi',
          email: 'admin@bemtevi.topa.com',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const auth = new HttpAuth(client, null)
    await expect(
      auth.login({ email: 'admin@bemtevi.topa.com', password: 'topa123' }),
    ).resolves.toBeDefined()
    expect(auth.getToken()).toBe('token-null-storage')

    expect(() => auth.logout()).not.toThrow()
    expect(auth.getToken()).toBeNull()
  })

  it('uses default message when error detail is missing in JSON response', async () => {
    const client = new HttpClient('http://test')
    vi.spyOn(client, 'post').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({}), { status: 401 })),
    )

    const auth = new HttpAuth(client, null)
    await expect(
      auth.login({ email: 'admin@bemtevi.topa.com', password: 'wrong' }),
    ).rejects.toThrow('E-mail ou senha incorretos.')
  })
})
