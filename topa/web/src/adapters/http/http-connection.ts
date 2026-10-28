import type { ConnectionPort } from '../../ports/connection'
import type { HttpClient } from './http-client'

// a hung API must read as unreachable instead of leaving the kiosk checking forever
const READINESS_TIMEOUT_MS = 3000

export class HttpConnection implements ConnectionPort {
  private readonly client: HttpClient

  constructor(client: HttpClient) {
    this.client = client
  }

  async isReachable(): Promise<boolean> {
    try {
      const response = await this.client.get('/health/ready', READINESS_TIMEOUT_MS)
      return response.ok
    } catch {
      return false
    }
  }
}
