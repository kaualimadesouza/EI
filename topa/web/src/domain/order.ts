import type { CartLine } from './cart'

export interface OrderDraft {
  lines: CartLine[]
  dineIn: boolean
  paymentMethod: 'card' | 'pix'
  /** Only an order placed on the customer's own phone is followed until it is ready. */
  placedOn: 'totem' | 'phone'
}

/** What the customer sees after paying, and the handle the phone follows the order by. */
export interface PlacedOrder {
  id: string
  number: number
  totalCents: number
  businessDate: string
}

/** A placed order as the dashboard follows it through the kitchen. */
export interface OrderSummary {
  id: string
  number: number
  status: 'received' | 'preparing' | 'ready' | 'delivered'
  dineIn: boolean
  paymentMethod: 'card' | 'pix'
  totalCents: number
  createdAt: string
  items: { productId: string; name: string; quantity: number; unitPriceCents: number }[]
}

/** The counter screen shows three digits: order 47 is "047". */
export function displayNumber(number: number): string {
  return String(number).padStart(3, '0')
}

/** Whole minutes since the order was placed; the dashboard flags the slow ones. */
export function ageMinutes(order: OrderSummary, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(order.createdAt).getTime()) / 60_000))
}
