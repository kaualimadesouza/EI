/** One place that knows the API base URL; adapters only speak paths. */
export class HttpClient {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  get(path: string): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`)
  }

  post(path: string, body: object): Promise<Response> {
    return this.send('POST', path, body)
  }

  patch(path: string, body: object): Promise<Response> {
    return this.send('PATCH', path, body)
  }

  private send(method: 'POST' | 'PATCH', path: string, body: object): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }
}
