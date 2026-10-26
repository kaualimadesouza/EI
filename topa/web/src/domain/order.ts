import type { CartLine } from './cart'

export interface OrderDraft {
  lines: CartLine[]
  dineIn: boolean
  paymentMethod: 'card' | 'pix'
}

export interface PlacedOrder {
  number: number
  totalCents: number
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
