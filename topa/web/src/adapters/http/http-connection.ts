import type { ConnectionPort } from '../../ports/connection'
import type { HttpClient } from './http-client'

// Lambda and Neon cold starts take a few seconds; retry once before giving up
const READINESS_TIMEOUT_MS = 6000

export class HttpConnection implements ConnectionPort {
  private readonly client: HttpClient

  constructor(client: HttpClient) {
    this.client = client
  }

  async isReachable(): Promise<boolean> {
    if (await this.ping()) {
      return true
    }
    return this.ping()
  }

  private async ping(): Promise<boolean> {
    try {
      const response = await this.client.get('/health/ready', READINESS_TIMEOUT_MS)
      return response.ok
    } catch {
      return false
    }
  }
}
