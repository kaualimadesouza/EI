import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomerAuthError } from '../../ports/customer-auth'
import type { KeyValueStore } from '../local/browser-storage'
import { HttpCustomerAuth } from './http-customer-auth'
import type { HttpClient } from './http-client'

class MemoryStore implements KeyValueStore {
  public store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

describe('HttpCustomerAuth', () => {
  let store: MemoryStore
  let fakeClient: {
    post: ReturnType<typeof vi.fn>
    get: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    store = new MemoryStore()
    fakeClient = {
      post: vi.fn(),
      get: vi.fn(),
    }
  })

  it('restores stored customer session on instantiation', () => {
    store.setItem(
      'topa_customer_session',
      JSON.stringify({
        token: 'existing-jwt',
        customer: { id: 'cust-1', name: 'Maria Silva', email: 'maria@email.com' },
      }),
    )

    const auth = new HttpCustomerAuth(fakeClient as unknown as HttpClient, store)
    expect(auth.getToken()).toBe('existing-jwt')
    expect(auth.getCustomer()).toEqual({
      id: 'cust-1',
      name: 'Maria Silva',
      email: 'maria@email.com',
    })
  })

  it('handles invalid json or malformed session gracefully', () => {
    store.setItem('topa_customer_session', 'invalid-json')
    const auth1 = new HttpCustomerAuth(fakeClient as unknown as HttpClient, store)
    expect(auth1.getToken()).toBeNull()
    expect(auth1.getCustomer()).toBeNull()

    store.setItem('topa_customer_session', JSON.stringify({ token: 123 }))
    const auth2 = new HttpCustomerAuth(fakeClient as unknown as HttpClient, store)
    expect(auth2.getToken()).toBeNull()
  })

  it('logs in customer successfully and persists session', async () => {
    fakeClient.post.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'cust-token-123',
        token_type: 'bearer',
        name: 'Maria Silva',
        email: 'maria@email.com',
      }),
    })

    const auth = new HttpCustomerAuth(fakeClient as unknown as HttpClient, store)
    const customer = await auth.login({ email: 'maria@email.com', password: 'secretpassword' })

    expect(fakeClient.post).toHaveBeenCalledWith(
      '/auth/customer/login',
      { email: 'maria@email.com', password: 'secretpassword' },
      null,
    )
    expect(customer).toEqual({ name: 'Maria Silva', email: 'maria@email.com' })
    expect(auth.getToken()).toBe('cust-token-123')
    expect(auth.getCustomer()).toEqual({ name: 'Maria Silva', email: 'maria@email.com' })
    expect(store.getItem('topa_customer_session')).toContain('cust-token-123')
  })

  it('throws CustomerAuthError with detail when login fails with json body', async () => {
    fakeClient.post.mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'Credenciais inválidas.' }),
    })

    const auth = new HttpCustomerAuth(fakeClient as unknown as HttpClient, store)
    await expect(auth.login({ email: 'maria@email.com', password: 'bad' })).rejects.toThrow(
      CustomerAuthError,
    )
    await expect(
      auth.login({ email: 'maria@email.com', password: 'bad' }),
    ).rejects.toThrow('Credenciais inválidas.')
  })

  it('throws CustomerAuthError with fallback message when response is not json', async () => {
    fakeClient.post.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error('Not JSON')
      },
    })

    const auth = new HttpCustomerAuth(fakeClient as unknown as HttpClient, store)
    await expect(auth.login({ email: 'x@x.com', password: 'bad' })).rejects.toThrow(
      'E-mail ou senha incorretos.',
    )

    fakeClient.post.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    })
    await expect(auth.login({ email: 'x@x.com', password: 'bad' })).rejects.toThrow(
      'E-mail ou senha incorretos.',
    )

    fakeClient.post.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: [{ loc: ['body', 'email'], msg: 'invalid' }] }),
    })
    await expect(auth.login({ email: 'x@x.com', password: 'bad' })).rejects.toThrow(
      'E-mail ou senha incorretos.',
    )
  })

  it('registers new customer successfully and persists session', async () => {
    fakeClient.post.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'new-cust-token',
        token_type: 'bearer',
        name: 'João Santos',
        email: 'joao@email.com',
      }),
    })

    const auth = new HttpCustomerAuth(fakeClient as unknown as HttpClient, store)
    const customer = await auth.register({
      name: 'João Santos',
      email: 'joao@email.com',
      password: 'password123',
    })

    expect(fakeClient.post).toHaveBeenCalledWith(
      '/auth/customer/register',
      { name: 'João Santos', email: 'joao@email.com', password: 'password123' },
      null,
    )
    expect(customer).toEqual({ name: 'João Santos', email: 'joao@email.com' })
    expect(auth.getToken()).toBe('new-cust-token')
    expect(store.getItem('topa_customer_session')).toContain('new-cust-token')
  })

  it('throws CustomerAuthError when registration fails with detail or fallback', async () => {
    fakeClient.post.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'E-mail já cadastrado.' }),
    })

    const auth = new HttpCustomerAuth(fakeClient as unknown as HttpClient, store)
    await expect(
      auth.register({ name: 'João', email: 'joao@email.com', password: '123' }),
    ).rejects.toThrow('E-mail já cadastrado.')

    fakeClient.post.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error('Crash')
      },
    })
    await expect(
      auth.register({ name: 'João', email: 'joao@email.com', password: '123' }),
    ).rejects.toThrow('Não foi possível concluir o cadastro.')

    fakeClient.post.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    })
    await expect(
      auth.register({ name: 'João', email: 'joao@email.com', password: '123' }),
    ).rejects.toThrow('Não foi possível concluir o cadastro.')

    fakeClient.post.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: [{ msg: 'invalid' }] }),
    })
    await expect(
      auth.register({ name: 'João', email: 'joao@email.com', password: '123' }),
    ).rejects.toThrow('Não foi possível concluir o cadastro.')
  })

  it('init returns null if no token is saved', async () => {
    const auth = new HttpCustomerAuth(fakeClient as unknown as HttpClient, store)
    const result = await auth.init()
    expect(result).toBeNull()
    expect(fakeClient.get).not.toHaveBeenCalled()
  })

  it('init updates profile with id when get customer me succeeds', async () => {
    store.setItem(
      'topa_customer_session',
      JSON.stringify({
        token: 'existing-jwt',
        customer: { name: 'Maria', email: 'maria@email.com' },
      }),
    )
    fakeClient.get.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'uuid-123', name: 'Maria Silva', email: 'maria@email.com' }),
    })

    const auth = new HttpCustomerAuth(fakeClient as unknown as HttpClient, store)
    const customer = await auth.init()

    expect(customer).toEqual({ id: 'uuid-123', name: 'Maria Silva', email: 'maria@email.com' })
    expect(auth.getCustomer()?.id).toBe('uuid-123')
  })

  it('init logs out when get customer me returns 401', async () => {
    store.setItem(
      'topa_customer_session',
      JSON.stringify({
        token: 'expired-jwt',
        customer: { name: 'Maria', email: 'maria@email.com' },
      }),
    )
    fakeClient.get.mockResolvedValueOnce({
      ok: false,
      status: 401,
    })

    const auth = new HttpCustomerAuth(fakeClient as unknown as HttpClient, store)
    const result = await auth.init()

    expect(result).toBeNull()
    expect(auth.getToken()).toBeNull()
    expect(auth.getCustomer()).toBeNull()
    expect(store.getItem('topa_customer_session')).toBe('')
  })

  it('init returns current cached customer if get customer me throws network error', async () => {
    store.setItem(
      'topa_customer_session',
      JSON.stringify({
        token: 'existing-jwt',
        customer: { name: 'Maria', email: 'maria@email.com' },
      }),
    )
    fakeClient.get.mockRejectedValueOnce(new Error('Network error'))

    const auth = new HttpCustomerAuth(fakeClient as unknown as HttpClient, store)
    const customer = await auth.init()

    expect(customer).toEqual({ name: 'Maria', email: 'maria@email.com' })
  })

  it('clears session on logout', () => {
    store.setItem(
      'topa_customer_session',
      JSON.stringify({
        token: 'existing-jwt',
        customer: { name: 'Maria', email: 'maria@email.com' },
      }),
    )

    const auth = new HttpCustomerAuth(fakeClient as unknown as HttpClient, store)
    auth.logout()

    expect(auth.getToken()).toBeNull()
    expect(auth.getCustomer()).toBeNull()
    expect(store.getItem('topa_customer_session')).toBe('')
  })

  it('handles null storage and storage exceptions silently', async () => {
    fakeClient.post.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'token-null-storage',
        name: 'Maria',
        email: 'maria@email.com',
      }),
    })

    const brokenStore: KeyValueStore = {
      getItem: () => {
        throw new Error('storage disabled')
      },
      setItem: () => {
        throw new Error('quota exceeded')
      },
    }

    const auth1 = new HttpCustomerAuth(fakeClient as unknown as HttpClient, null)
    await auth1.login({ email: 'maria@email.com', password: '123' })
    auth1.logout()
    expect(auth1.getToken()).toBeNull()

    const auth2 = new HttpCustomerAuth(fakeClient as unknown as HttpClient, brokenStore)
    auth2.logout()
    expect(auth2.getToken()).toBeNull()
  })

  it('authenticates customer via Google SSO and saves session', async () => {
    fakeClient.post.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'google-jwt-123',
        token_type: 'bearer',
        name: 'Aluno Google',
        email: 'aluno@usp.br',
      }),
    })

    const auth = new HttpCustomerAuth(fakeClient as unknown as HttpClient, store)
    const customer = await auth.loginWithGoogle({
      idToken: 'custom-google-id-token',
      name: 'Aluno Google',
      email: 'aluno@usp.br',
    })

    expect(fakeClient.post).toHaveBeenCalledWith(
      '/auth/customer/google',
      {
        id_token: 'custom-google-id-token',
      },
      null,
    )
    expect(customer).toEqual({ name: 'Aluno Google', email: 'aluno@usp.br' })
    expect(auth.getToken()).toBe('google-jwt-123')
    expect(store.getItem('topa_customer_session')).toContain('google-jwt-123')
  })

  it('authenticates customer via Google SSO with default payload', async () => {
    fakeClient.post.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'google-default-token',
        token_type: 'bearer',
        name: 'Default Name',
        email: 'default@email.com',
      }),
    })

    const auth = new HttpCustomerAuth(fakeClient as unknown as HttpClient, store)
    const customer = await auth.loginWithGoogle()

    expect(fakeClient.post).toHaveBeenCalledWith(
      '/auth/customer/google',
      {
        id_token: 'google-oauth-demo-token',
      },
      null,
    )
    expect(customer.name).toBe('Default Name')
  })

  it('throws CustomerAuthError with detail on Google SSO failure', async () => {
    fakeClient.post.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'Token do Google inválido ou expirado.' }),
    })

    const auth = new HttpCustomerAuth(fakeClient as unknown as HttpClient, store)
    await expect(auth.loginWithGoogle()).rejects.toThrow('Token do Google inválido ou expirado.')
  })

  it('throws CustomerAuthError with fallback detail when Google SSO response cannot be parsed', async () => {
    fakeClient.post.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error('Malformed JSON')
      },
    })

    const auth = new HttpCustomerAuth(fakeClient as unknown as HttpClient, store)
    await expect(auth.loginWithGoogle()).rejects.toThrow('Não foi possível autenticar com o Google.')
  })

  it('throws CustomerAuthError with fallback detail when Google SSO body has no string detail', async () => {
    fakeClient.post.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    })

    const auth = new HttpCustomerAuth(fakeClient as unknown as HttpClient, store)
    await expect(auth.loginWithGoogle()).rejects.toThrow('Não foi possível autenticar com o Google.')
  })
})
