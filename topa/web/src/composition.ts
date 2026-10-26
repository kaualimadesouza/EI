import { HttpConnection } from './adapters/http/http-connection'
import { LocalConnection } from './adapters/local/local-connection'
import type { Adapters } from './ports/adapters'

/** The only place that picks adapters: an API URL means the local backend, none means demo mode. */
export function createAdapters(apiUrl: string | undefined): Adapters {
  if (apiUrl) {
    return { mode: 'api', connection: new HttpConnection(apiUrl) }
  }
  return { mode: 'demo', connection: new LocalConnection() }
}
