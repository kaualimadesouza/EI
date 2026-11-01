import { beforeEach, describe, expect, it } from 'vitest'
import { CustomerAuthError } from '../../ports/customer-auth'
import type { KeyValueStore } from './browser-storage'
import { LocalCustomerAuth } from './local-customer-auth'

class MemoryStore implements KeyValueStore {
  public store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

describe('LocalCustomerAuth', () => {
  let store: MemoryStore

  beforeEach(() => {
    store = new MemoryStore()
  })

  it('restores stored customer session on initialization', () => {
    store.setItem(
      'topa_demo_customer_session',
      JSON.stringify({
        token: 'stored-demo-token',
        customer: { id: 'cust-xyz', name: 'Ana', email: 'ana@email.com' },
      }),
    )

    const auth = new LocalCustomerAuth({ storage: store })
    expect(auth.getToken()).toBe('stored-demo-token')
    expect(auth.getCustomer()).toEqual({
      id: 'cust-xyz',
      name: 'Ana',
      email: 'ana@email.com',
    })
  })

  it('ignores invalid json or malformed payload in storage', () => {
    store.setItem('topa_demo_customer_session', 'bad json')
    const auth1 = new LocalCustomerAuth({ storage: store })
    expect(auth1.getToken()).toBeNull()

    store.setItem('topa_demo_customer_session', JSON.stringify({ token: 123 }))
    const auth2 = new LocalCustomerAuth({ storage: store })
    expect(auth2.getToken()).toBeNull()
  })

  it('authenticates with default credentials', async () => {
    const auth = new LocalCustomerAuth({ storage: store })
    const customer = await auth.login({ email: 'cliente@topa.com', password: 'topa123' })

    expect(customer.name).toBe('Cliente Universitário')
    expect(auth.getToken()).toBe('demo-customer-token-demo-cust-1')
    expect(store.getItem('topa_demo_customer_session')).toContain('demo-customer-token-demo-cust-1')
  })

  it('throws CustomerAuthError on invalid credentials', async () => {
    const auth = new LocalCustomerAuth({ storage: store })
    await expect(
      auth.login({ email: 'cliente@topa.com', password: 'wrongpassword' }),
    ).rejects.toThrow(CustomerAuthError)
  })

  it('registers new account and logs in', async () => {
    const auth = new LocalCustomerAuth({ storage: store })
    const customer = await auth.register({
      name: 'Carlos Mendes',
      email: 'carlos@mendes.com',
      password: 'password123',
    })

    expect(customer.name).toBe('Carlos Mendes')
    expect(customer.email).toBe('carlos@mendes.com')
    expect(auth.getToken()).toBe('demo-customer-token-demo-cust-2')

    // Can log in with new credentials
    auth.logout()
    expect(auth.getCustomer()).toBeNull()

    const logged = await auth.login({
      email: 'carlos@mendes.com',
      password: 'password123',
    })
    expect(logged.name).toBe('Carlos Mendes')
  })

  it('throws error when registering duplicate email', async () => {
    const auth = new LocalCustomerAuth({ storage: store })
    await expect(
      auth.register({
        name: 'Outro',
        email: 'cliente@topa.com',
        password: 'pass',
      }),
    ).rejects.toThrow('E-mail já cadastrado.')
  })

  it('clears session on logout', async () => {
    const auth = new LocalCustomerAuth({ storage: store })
    await auth.login({ email: 'cliente@topa.com', password: 'topa123' })
    expect(auth.getToken()).not.toBeNull()

    auth.logout()
    expect(auth.getToken()).toBeNull()
    expect(auth.getCustomer()).toBeNull()
    expect(store.getItem('topa_demo_customer_session')).toBe('')
  })

  it('init reloads customer session and returns it', async () => {
    const auth = new LocalCustomerAuth({ storage: store })
    const empty = await auth.init()
    expect(empty).toBeNull()

    store.setItem(
      'topa_demo_customer_session',
      JSON.stringify({
        token: 'token-abc',
        customer: { id: '1', name: 'User', email: 'user@test.com' },
      }),
    )

    const reloaded = await auth.init()
    expect(reloaded).toEqual({ id: '1', name: 'User', email: 'user@test.com' })
  })

  it('handles null storage and storage exceptions gracefully', async () => {
    const brokenStore: KeyValueStore = {
      getItem: () => {
        throw new Error('error')
      },
      setItem: () => {
        throw new Error('error')
      },
    }

    const auth1 = new LocalCustomerAuth({ storage: null })
    await auth1.login({ email: 'cliente@topa.com', password: 'topa123' })
    expect(auth1.getToken()).not.toBeNull()
    auth1.logout()
    expect(auth1.getToken()).toBeNull()

    const auth2 = new LocalCustomerAuth({ storage: brokenStore })
    auth2.logout()
    expect(auth2.getToken()).toBeNull()
  })

  it('accepts initial customer and token in constructor', () => {
    const auth = new LocalCustomerAuth({
      initialCustomer: { id: 'init-1', name: 'Initial', email: 'init@test.com' },
      initialToken: 'init-token',
      storage: store,
    })

    expect(auth.getCustomer()).toEqual({ id: 'init-1', name: 'Initial', email: 'init@test.com' })
    expect(auth.getToken()).toBe('init-token')
  })

  it('accepts custom accounts list in options', async () => {
    const customAccounts = [
      {
        id: 'custom-1',
        name: 'Custom User',
        email: 'custom@user.com',
        password: 'custompassword',
      },
    ]
    const auth = new LocalCustomerAuth({ accounts: customAccounts, storage: store })
    const customer = await auth.login({ email: 'custom@user.com', password: 'custompassword' })
    expect(customer.name).toBe('Custom User')
  })

  it('authenticates with google sso creating new customer when not found', async () => {
    const auth = new LocalCustomerAuth({ storage: store })
    const customer = await auth.loginWithGoogle({
      name: 'Novo Google User',
      email: 'novo.google@usp.br',
    })

    expect(customer.name).toBe('Novo Google User')
    expect(customer.email).toBe('novo.google@usp.br')
    expect(auth.getToken()).toContain('demo-google-token-google-cust-')
    expect(store.getItem('topa_demo_customer_session')).toContain('novo.google@usp.br')
  })

  it('authenticates with google sso reusing existing account and defaults', async () => {
    const auth = new LocalCustomerAuth({ storage: store })
    // first call with defaults
    const cust1 = await auth.loginWithGoogle()
    expect(cust1.email).toBe('aluno.usp@usp.br')
    expect(cust1.name).toBe('Aluno USP (Google)')

    auth.logout()

    // second call with same email matches existing account
    const cust2 = await auth.loginWithGoogle({
      email: 'aluno.usp@usp.br',
    })
    expect(cust2.id).toBe(cust1.id)
  })
})
