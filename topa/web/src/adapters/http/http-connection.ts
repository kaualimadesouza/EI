import type { ConnectionPort } from '../../ports/connection'

export class HttpConnection implements ConnectionPort {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async isReachable(): Promise<boolean> {
    try {
      // a hung API must read as unreachable instead of leaving the kiosk checking forever
      const response = await fetch(`${this.baseUrl}/health/ready`, { signal: AbortSignal.timeout(3000) })
      return response.ok
    } catch {
      return false
    }
  }
}
