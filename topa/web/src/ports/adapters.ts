import type { AuthPort } from './auth'
import type { BuzzerPort } from './buzzer'
import type { ConnectionPort } from './connection'
import type { CustomerAuthPort } from './customer-auth'
import type { MenuPort } from './menu'
import type { NfcPort } from './nfc'
import type { OrdersPort } from './orders'
import type { PaymentPort } from './payment'
import type { PrinterPort } from './printer'
import type { RecommendationsPort } from './recommendations'
import type { StoresPort } from './stores'
import type { TagPort } from './tag'
import type { TotemSessionPort } from './totem-session'
import type { VoiceRecognitionPort } from './voice'
import type { WakeLockPort } from './wake-lock'

/** What the composition root hands the UI: the mode it picked and the ports that serve it. */
export interface Adapters {
  mode: 'api' | 'demo'
  connection: ConnectionPort
  menu: MenuPort
  orders: OrdersPort
  payment: PaymentPort
  nfc: NfcPort
  tag: TagPort
  buzzer: BuzzerPort
  wakeLock: WakeLockPort
  auth: AuthPort
  customerAuth: CustomerAuthPort
  stores: StoresPort
  totemSession: TotemSessionPort
  recommendations: RecommendationsPort
  voice: VoiceRecognitionPort
  printer: PrinterPort
}
