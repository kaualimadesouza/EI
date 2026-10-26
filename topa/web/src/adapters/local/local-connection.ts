import type { Connection, ConnectionPort } from '../../ports/connection'

export class LocalConnection implements ConnectionPort {
  check(): Promise<Connection> {
    return Promise.resolve({ mode: 'demo', reachable: true })
  }
}
