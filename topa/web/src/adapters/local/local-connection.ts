import type { ConnectionPort } from '../../ports/connection'

export class LocalConnection implements ConnectionPort {
  isReachable(): Promise<boolean> {
    return Promise.resolve(true)
  }
}
