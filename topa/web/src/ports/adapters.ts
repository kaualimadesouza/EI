import type { ConnectionPort } from './connection'
import type { MenuPort } from './menu'
import type { OrdersPort } from './orders'

/** What the composition root hands the UI: the mode it picked and the ports that serve it. */
export interface Adapters {
  mode: 'api' | 'demo'
  connection: ConnectionPort
  menu: MenuPort
  orders: OrdersPort
}
