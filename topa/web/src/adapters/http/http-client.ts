const REQUEST_TIMEOUT_MS = 10_000

/** One place that knows the API base URL; adapters only speak paths. */
export class HttpClient {
  private readonly baseUrl: string
  private token: string | null

  constructor(baseUrl: string, token: string | null = null) {
    this.baseUrl = baseUrl
    this.token = token
  }

  setToken(token: string | null): void {
    this.token = token
  }

  getToken(): string | null {
    return this.token
  }

  get(path: string, timeoutMs = REQUEST_TIMEOUT_MS, token?: string | null): Promise<Response> {
    const headers = this.authHeaders(token)
    return this.request(path, timeoutMs, Object.keys(headers).length > 0 ? { headers } : undefined)
  }

  post(path: string, body: object, token?: string | null): Promise<Response> {
    return this.send('POST', path, body, token)
  }

  patch(path: string, body: object, token?: string | null): Promise<Response> {
    return this.send('PATCH', path, body, token)
  }

  private authHeaders(explicitToken?: string | null): Record<string, string> {
    const bearer = explicitToken !== undefined ? explicitToken : this.token
    return bearer ? { Authorization: `Bearer ${bearer}` } : {}
  }

  private send(
    method: 'POST' | 'PATCH',
    path: string,
    body: object,
    token?: string | null,
  ): Promise<Response> {
    return this.request(path, REQUEST_TIMEOUT_MS, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...this.authHeaders(token),
      },
      body: JSON.stringify(body),
    })
  }

  private request(path: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    })
  }
}
