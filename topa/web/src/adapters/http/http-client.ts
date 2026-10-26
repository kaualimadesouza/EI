const REQUEST_TIMEOUT_MS = 10_000

/** One place that knows the API base URL; adapters only speak paths. */
export class HttpClient {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  get(path: string): Promise<Response> {
    return this.request(path)
  }

  post(path: string, body: object): Promise<Response> {
    return this.send('POST', path, body)
  }

  patch(path: string, body: object): Promise<Response> {
    return this.send('PATCH', path, body)
  }

  private send(method: 'POST' | 'PATCH', path: string, body: object): Promise<Response> {
    return this.request(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  private request(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  }
}
