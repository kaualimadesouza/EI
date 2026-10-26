import { HttpConnection } from './adapters/http/http-connection'
import { LocalConnection } from './adapters/local/local-connection'
import type { ConnectionPort } from './ports/connection'

export interface Adapters {
  connection: ConnectionPort
}

/** The only place that picks adapters: an API URL means the local backend, none means demo mode. */
export function createAdapters(apiUrl: string | undefined): Adapters {
  if (apiUrl) {
    return { connection: new HttpConnection(apiUrl) }
  }
  return { connection: new LocalConnection() }
}
