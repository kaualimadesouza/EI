import type { ConnectionPort } from './connection'

/** What the composition root hands the UI: the mode it picked and the ports that serve it. */
export interface Adapters {
  mode: 'api' | 'demo'
  connection: ConnectionPort
}
