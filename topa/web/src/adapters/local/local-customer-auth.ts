import { browserStorage, type KeyValueStore } from './browser-storage'
import {
  type AuthenticatedCustomer,
  CustomerAuthError,
  type CustomerAuthPort,
  type CustomerCredentials,
  type CustomerRegistration,
  type GoogleAuthPayload,
} from '../../ports/customer-auth'

const DEMO_STORAGE_KEY = 'topa_demo_customer_session'

export interface DemoCustomerAccount {
  id: string
  name: string
  email: string
  password: string
}

const DEFAULT_CUSTOMER_ACCOUNTS: DemoCustomerAccount[] = [
  {
    id: 'demo-cust-1',
    name: 'Cliente Universitário',
    email: 'cliente@topa.com',
    password: 'topa123',
  },
]

export interface LocalCustomerAuthOptions {
  storage?: KeyValueStore | null
  initialCustomer?: AuthenticatedCustomer | null
  initialToken?: string | null
  accounts?: DemoCustomerAccount[]
}

/** Local demo implementation of customer authentication port. */
export class LocalCustomerAuth implements CustomerAuthPort {
  private readonly storage: KeyValueStore | null
  private readonly accounts: DemoCustomerAccount[]
  private token: string | null = null
  private customer: AuthenticatedCustomer | null = null

  constructor(options: LocalCustomerAuthOptions = {}) {
    this.storage = options.storage !== undefined ? options.storage : browserStorage()
    this.accounts = options.accounts ? [...options.accounts] : [...DEFAULT_CUSTOMER_ACCOUNTS]
    this.token = options.initialToken ?? null
    this.customer = options.initialCustomer ?? null

    if (!this.customer) {
      this.restoreSession()
    }
  }

  async login(credentials: CustomerCredentials): Promise<AuthenticatedCustomer> {
    const account = this.accounts.find(
      (item) => item.email === credentials.email && item.password === credentials.password,
    )

    if (!account) {
      throw new CustomerAuthError('E-mail ou senha incorretos.')
    }

    this.token = `demo-customer-token-${account.id}`
    this.customer = {
      id: account.id,
      name: account.name,
      email: account.email,
    }

    this.persistSession()
    return this.customer
  }

  async loginWithGoogle(payload?: GoogleAuthPayload): Promise<AuthenticatedCustomer> {
    const email = payload?.email ?? 'aluno.usp@usp.br'
    const name = payload?.name ?? 'Aluno USP (Google)'
    const existing = this.accounts.find((item) => item.email === email)
    const id = existing?.id ?? `google-cust-${this.accounts.length + 1}`

    if (!existing) {
      this.accounts.push({
        id,
        name,
        email,
        password: 'sso-google-nopassword',
      })
    }

    this.token = `demo-google-token-${id}`
    this.customer = {
      id,
      name: existing?.name ?? name,
      email,
    }

    this.persistSession()
    return this.customer
  }

  async register(data: CustomerRegistration): Promise<AuthenticatedCustomer> {
    const existing = this.accounts.find((item) => item.email === data.email)
    if (existing) {
      throw new CustomerAuthError('E-mail já cadastrado.')
    }

    const newId = `demo-cust-${this.accounts.length + 1}`
    const account: DemoCustomerAccount = {
      id: newId,
      name: data.name,
      email: data.email,
      password: data.password,
    }
    this.accounts.push(account)

    this.token = `demo-customer-token-${newId}`
    this.customer = {
      id: account.id,
      name: account.name,
      email: account.email,
    }

    this.persistSession()
    return this.customer
  }

  async init(): Promise<AuthenticatedCustomer | null> {
    this.restoreSession()
    return this.customer
  }

  logout(): void {
    this.token = null
    this.customer = null
    this.clearSession()
  }

  getToken(): string | null {
    return this.token
  }

  getCustomer(): AuthenticatedCustomer | null {
    return this.customer
  }

  private restoreSession(): void {
    try {
      const raw = this.storage?.getItem(DEMO_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<{ token: string; customer: AuthenticatedCustomer }>
      if (
        typeof parsed?.token === 'string' &&
        typeof parsed?.customer?.name === 'string' &&
        typeof parsed?.customer?.email === 'string'
      ) {
        this.token = parsed.token
        this.customer = parsed.customer
      }
    } catch {
      // Ignore corrupted stored session.
    }
  }

  private persistSession(): void {
    if (!this.storage) return
    try {
      this.storage.setItem(
        DEMO_STORAGE_KEY,
        JSON.stringify({
          token: this.token,
          customer: this.customer,
        }),
      )
    } catch {
      // Ignore storage errors.
    }
  }

  private clearSession(): void {
    if (!this.storage) return
    try {
      this.storage.setItem(DEMO_STORAGE_KEY, '')
    } catch {
      // Ignore storage errors.
    }
  }
}
