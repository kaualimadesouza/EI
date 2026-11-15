import { browserStorage, type KeyValueStore } from '../local/browser-storage'
import {
  type AuthenticatedMerchant,
  AuthError,
  type AuthPort,
  type LoginCredentials,
  type MerchantRegistration,
} from '../../ports/auth'
import type { HttpClient } from './http-client'

const STORAGE_KEY = 'topa_merchant_session'

interface LoginResponseJson {
  access_token: string
  token_type: string
  store_slug: string
  email: string
}

interface ErrorJson {
  detail?: string
}

interface StoredSession {
  token: string
  merchant: AuthenticatedMerchant
}

/** HTTP implementation of merchant authentication port. */
export class HttpAuth implements AuthPort {
  private readonly client: HttpClient
  private readonly storage: KeyValueStore | null
  private token: string | null = null
  private merchant: AuthenticatedMerchant | null = null

  constructor(client: HttpClient, storage: KeyValueStore | null = browserStorage()) {
    this.client = client
    this.storage = storage
    this.restoreSession()
  }

  async login(credentials: LoginCredentials): Promise<AuthenticatedMerchant> {
    return this.authenticate('/auth/login', {
      email: credentials.email,
      password: credentials.password,
    })
  }

  async register(registration: MerchantRegistration): Promise<AuthenticatedMerchant> {
    return this.authenticate('/auth/register', {
      store_name: registration.storeName,
      email: registration.email,
      password: registration.password,
    })
  }

  private async authenticate(path: string, body: Record<string, string>): Promise<AuthenticatedMerchant> {
    const response = await this.client.post(path, body).catch(() => {
      throw new AuthError('Não foi possível conectar ao TOPA. Verifique sua conexão e tente de novo.')
    })

    if (!response.ok) {
      let detail = 'E-mail ou senha incorretos.'
      try {
        const body = (await response.json()) as ErrorJson
        if (body?.detail) {
          detail = body.detail
        }
      } catch {
        // Fallback message is kept when response body is not JSON.
      }
      throw new AuthError(detail)
    }

    const data = (await response.json()) as LoginResponseJson
    this.token = data.access_token
    this.merchant = {
      email: data.email,
      storeSlug: data.store_slug,
    }

    this.client.setToken(this.token)
    this.persistSession()

    return this.merchant
  }

  logout(): void {
    this.token = null
    this.merchant = null
    this.client.setToken(null)
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
      const raw = this.storage?.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<StoredSession>
      if (
        typeof parsed?.token === 'string' &&
        typeof parsed?.merchant?.email === 'string' &&
        typeof parsed?.merchant?.storeSlug === 'string'
      ) {
        this.token = parsed.token
        this.merchant = {
          email: parsed.merchant.email,
          storeSlug: parsed.merchant.storeSlug,
        }
        this.client.setToken(this.token)
      }
    } catch {
      // Ignore corrupted stored session.
    }
  }

  private persistSession(): void {
    if (!this.storage) return
    try {
      this.storage.setItem(
        STORAGE_KEY,
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
      this.storage.setItem(STORAGE_KEY, '')
    } catch {
      // Ignore storage errors.
    }
  }
}
