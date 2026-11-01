import type {
  TotemSessionCreation,
  TotemSessionPort,
  TotemSessionResult,
} from '../../ports/totem-session'
import type { HttpClient } from './http-client'

interface CreateResponseJson {
  token: string
  url: string
  expires_at: string
}

interface ValidateResponseJson {
  valid: boolean
  store_slug?: string
  expires_at?: string
  seconds_remaining?: number
  reason?: string
}

export class HttpTotemSession implements TotemSessionPort {
  private readonly client: HttpClient

  constructor(client: HttpClient) {
    this.client = client
  }

  async createSession(storeSlug: string, durationSeconds = 1800): Promise<TotemSessionCreation> {
    const response = await this.client.post('/totem/sessions', {
      store_slug: storeSlug,
      duration_seconds: durationSeconds,
    })
    if (!response.ok) {
      throw new Error(`POST /totem/sessions failed with ${response.status}`)
    }
    const data = (await response.json()) as CreateResponseJson
    return {
      token: data.token,
      url: data.url,
      expiresAt: data.expires_at,
    }
  }

  async validateSession(token: string, storeSlug?: string): Promise<TotemSessionResult> {
    const query = new URLSearchParams({ token })
    if (storeSlug) {
      query.set('store_slug', storeSlug)
    }
    const response = await this.client.get(`/totem/sessions/validate?${query.toString()}`, undefined, null)
    if (!response.ok) {
      return { valid: false, reason: 'request_failed' }
    }
    const data = (await response.json()) as ValidateResponseJson
    if (data.valid && data.store_slug && data.expires_at && data.seconds_remaining !== undefined) {
      return {
        valid: true,
        storeSlug: data.store_slug,
        expiresAt: data.expires_at,
        secondsRemaining: data.seconds_remaining,
      }
    }
    return {
      valid: false,
      reason: data.reason ?? 'invalid',
      storeSlug: data.store_slug,
    }
  }
}
