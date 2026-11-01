import { browserStorage, type KeyValueStore } from '../local/browser-storage'
import {
  type AuthenticatedCustomer,
  CustomerAuthError,
  type CustomerAuthPort,
  type CustomerCredentials,
  type CustomerRegistration,
} from '../../ports/customer-auth'
import type { HttpClient } from './http-client'

const STORAGE_KEY = 'topa_customer_session'

interface CustomerAuthResponseJson {
  access_token: string
  token_type: string
  name: string
  email: string
}

interface CustomerMeResponseJson {
  id: string
  name: string
  email: string
}

interface ErrorJson {
  detail?: string
}

interface StoredCustomerSession {
  token: string
  customer: AuthenticatedCustomer
}

/** HTTP implementation of customer authentication port. */
export class HttpCustomerAuth implements CustomerAuthPort {
  private readonly client: HttpClient
  private readonly storage: KeyValueStore | null
  private token: string | null = null
  private customer: AuthenticatedCustomer | null = null

  constructor(client: HttpClient, storage: KeyValueStore | null = browserStorage()) {
    this.client = client
    this.storage = storage
    this.restoreSession()
  }

  async login(credentials: CustomerCredentials): Promise<AuthenticatedCustomer> {
    const response = await this.client.post(
      '/auth/customer/login',
      {
        email: credentials.email,
        password: credentials.password,
      },
      null,
    )

    if (!response.ok) {
      let detail = 'E-mail ou senha incorretos.'
      try {
        const body = (await response.json()) as ErrorJson
        if (typeof body?.detail === 'string') {
          detail = body.detail
        }
      } catch {
        // Fallback message kept when body is not valid JSON.
      }
      throw new CustomerAuthError(detail)
    }

    const data = (await response.json()) as CustomerAuthResponseJson
    this.token = data.access_token
    const customer: AuthenticatedCustomer = {
      name: data.name,
      email: data.email,
    }
    this.customer = customer

    this.persistSession()
    return customer
  }

  async loginWithGoogle(): Promise<AuthenticatedCustomer> {
    throw new CustomerAuthError(
      'Login com Google em homologação institucional USP. Por favor, acesse com seu e-mail e senha cadastrados.',
    )
  }

  async register(data: CustomerRegistration): Promise<AuthenticatedCustomer> {
    const response = await this.client.post(
      '/auth/customer/register',
      {
        name: data.name,
        email: data.email,
        password: data.password,
      },
      null,
    )

    if (!response.ok) {
      let detail = 'Não foi possível concluir o cadastro.'
      try {
        const body = (await response.json()) as ErrorJson
        if (typeof body?.detail === 'string') {
          detail = body.detail
        }
      } catch {
        // Fallback message kept when body is not valid JSON.
      }
      throw new CustomerAuthError(detail)
    }

    const res = (await response.json()) as CustomerAuthResponseJson
    this.token = res.access_token
    const customer: AuthenticatedCustomer = {
      name: res.name,
      email: res.email,
    }
    this.customer = customer

    this.persistSession()
    return customer
  }

  async init(): Promise<AuthenticatedCustomer | null> {
    if (!this.token) {
      return null
    }

    try {
      const response = await this.client.get('/auth/customer/me', undefined, this.token)
      if (!response.ok) {
        this.logout()
        return null
      }
      const data = (await response.json()) as CustomerMeResponseJson
      this.customer = {
        id: data.id,
        name: data.name,
        email: data.email,
      }
      this.persistSession()
      return this.customer
    } catch {
      return this.customer
    }
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
      const raw = this.storage?.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<StoredCustomerSession>
      if (
        typeof parsed?.token === 'string' &&
        typeof parsed?.customer?.name === 'string' &&
        typeof parsed?.customer?.email === 'string'
      ) {
        this.token = parsed.token
        this.customer = {
          id: parsed.customer.id,
          name: parsed.customer.name,
          email: parsed.customer.email,
        }
      }
    } catch {
      // Corrupted storage is silently ignored.
    }
  }

  private persistSession(): void {
    if (!this.storage) return
    try {
      this.storage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          token: this.token,
          customer: this.customer,
        }),
      )
    } catch {
      // Storage errors silently ignored.
    }
  }

  private clearSession(): void {
    if (!this.storage) return
    try {
      this.storage.setItem(STORAGE_KEY, '')
    } catch {
      // Storage errors silently ignored.
    }
  }
}
