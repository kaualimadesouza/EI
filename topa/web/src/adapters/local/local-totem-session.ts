import type {
  TotemSessionCreation,
  TotemSessionPort,
  TotemSessionResult,
} from '../../ports/totem-session'

export class LocalTotemSession implements TotemSessionPort {
  private readonly sessions = new Map<string, { storeSlug: string; expiresAt: number }>()

  async createSession(storeSlug: string, durationSeconds = 1800): Promise<TotemSessionCreation> {
    const expiresAtMs = Date.now() + durationSeconds * 1000
    const token = `demo-session-${storeSlug}-${Math.random().toString(36).slice(2, 10)}`
    this.sessions.set(token, { storeSlug, expiresAt: expiresAtMs })
    return {
      token,
      url: `https://topa-totem.vercel.app/?loja=${storeSlug}&sessao=${token}`,
      expiresAt: new Date(expiresAtMs).toISOString(),
    }
  }

  async validateSession(token: string, storeSlug?: string): Promise<TotemSessionResult> {
    const session = this.sessions.get(token)
    if (!session) {
      // In demo mode, accept any non-empty token containing demo-session
      if (token.startsWith('demo-session-')) {
        const afterPrefix = token.slice('demo-session-'.length)
        const parts = afterPrefix.split('-')
        const inferredFromToken = parts.length > 1 ? parts.slice(0, -1).join('-') : afterPrefix
        const inferredSlug = storeSlug ?? inferredFromToken
        return {
          valid: true,
          storeSlug: inferredSlug || 'lanchonete-bem-te-vi',
          secondsRemaining: 1800,
        }
      }
      return { valid: false, reason: 'invalid_or_expired' }
    }
    if (Date.now() > session.expiresAt) {
      return { valid: false, reason: 'expired' }
    }
    if (storeSlug && session.storeSlug !== storeSlug) {
      return { valid: false, storeSlug: session.storeSlug, reason: 'store_mismatch' }
    }
    return {
      valid: true,
      storeSlug: session.storeSlug,
      expiresAt: new Date(session.expiresAt).toISOString(),
      secondsRemaining: Math.round((session.expiresAt - Date.now()) / 1000),
    }
  }
}
