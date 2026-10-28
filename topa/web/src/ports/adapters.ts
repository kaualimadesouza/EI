import type { BuzzerPort } from './buzzer'
import type { ConnectionPort } from './connection'
import type { MenuPort } from './menu'
import type { NfcPort } from './nfc'
import type { OrdersPort } from './orders'
import type { TagPort } from './tag'
import type { WakeLockPort } from './wake-lock'

/** What the composition root hands the UI: the mode it picked and the ports that serve it. */
export interface Adapters {
  mode: 'api' | 'demo'
  connection: ConnectionPort
  menu: MenuPort
  orders: OrdersPort
  nfc: NfcPort
  tag: TagPort
  buzzer: BuzzerPort
  wakeLock: WakeLockPort
}
