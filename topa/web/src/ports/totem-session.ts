export type TotemSessionResult =
  | {
      valid: true
      storeSlug: string
      expiresAt: string
      secondsRemaining: number
      reason?: undefined
    }
  | {
      valid: false
      reason: string
      storeSlug?: string
      expiresAt?: undefined
      secondsRemaining?: undefined
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
