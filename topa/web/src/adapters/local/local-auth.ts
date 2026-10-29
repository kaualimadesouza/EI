import { browserStorage, type KeyValueStore } from './browser-storage'
import {
  type AuthenticatedMerchant,
  AuthError,
  type AuthPort,
  type LoginCredentials,
} from '../../ports/auth'

const DEMO_STORAGE_KEY = 'topa_demo_merchant_session'

export interface DemoAccount {
  email: string
  password: string
  storeSlug: string
}

const DEFAULT_ACCOUNTS: DemoAccount[] = [
  {
    email: 'admin@bemtevi.topa.com',
    password: 'topa123',
    storeSlug: 'lanchonete-bem-te-vi',
  },
]

export interface LocalAuthOptions {
  storage?: KeyValueStore | null
  initialMerchant?: AuthenticatedMerchant | null
  initialToken?: string | null
  accounts?: DemoAccount[]
}

/** Local demo implementation of merchant authentication port. */
export class LocalAuth implements AuthPort {
  private readonly storage: KeyValueStore | null
  private readonly accounts: DemoAccount[]
  private token: string | null = null
  private merchant: AuthenticatedMerchant | null = null

  constructor(options: LocalAuthOptions = {}) {
    this.storage = options.storage !== undefined ? options.storage : browserStorage()
    this.accounts = options.accounts ?? DEFAULT_ACCOUNTS
    this.token = options.initialToken ?? null
    this.merchant = options.initialMerchant ?? null

    if (!this.merchant) {
      this.restoreSession()
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthenticatedMerchant> {
    const account = this.accounts.find(
      (item) => item.email === credentials.email && item.password === credentials.password,
    )

    if (!account) {
      throw new AuthError('E-mail ou senha incorretos.')
    }

    this.token = `demo-token-${account.storeSlug}`
    this.merchant = {
      email: account.email,
      storeSlug: account.storeSlug,
    }

    this.persistSession()
    return this.merchant
  }

  logout(): void {
    this.token = null
    this.merchant = null
    this.clearSession()
  }

  getToken(): string | null {
    return this.token
  }

  getMerchant(): AuthenticatedMerchant | null {
    return this.merchant
  }

  private restoreSession(): void {
    try {
      const raw = this.storage?.getItem(DEMO_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { token: string; merchant: AuthenticatedMerchant }
      if (
        typeof parsed?.token === 'string' &&
        typeof parsed?.merchant?.email === 'string' &&
        typeof parsed?.merchant?.storeSlug === 'string'
      ) {
        this.token = parsed.token
        this.merchant = parsed.merchant
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
          merchant: this.merchant,
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
