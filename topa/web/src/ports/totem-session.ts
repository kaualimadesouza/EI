export interface TotemSessionResult {
  valid: boolean
  storeSlug?: string
  expiresAt?: string
  secondsRemaining?: number
  reason?: string
}

export interface TotemSessionCreation {
  token: string
  url: string
  expiresAt: string
}

export interface TotemSessionPort {
  createSession(storeSlug: string, durationSeconds?: number): Promise<TotemSessionCreation>
  validateSession(token: string, storeSlug?: string): Promise<TotemSessionResult>
}
