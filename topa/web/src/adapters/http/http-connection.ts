import type { Connection, ConnectionPort } from '../../ports/connection'

export class HttpConnection implements ConnectionPort {
  private readonly baseUrl: string
  private readonly fetchFn: typeof fetch

  // the wrapper keeps `this` out of fetch: a bare reference throws "Illegal invocation"
  constructor(baseUrl: string, fetchFn: typeof fetch = (input, init) => fetch(input, init)) {
    this.baseUrl = baseUrl
    this.fetchFn = fetchFn
  }

  async check(): Promise<Connection> {
    try {
      const response = await this.fetchFn(`${this.baseUrl}/health/ready`)
      return { mode: 'api', reachable: response.ok }
    } catch {
      return { mode: 'api', reachable: false }
    }
  }
}
