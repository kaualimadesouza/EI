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

/** The counter screen shows three digits: order 47 is "047". */
export function displayNumber(number: number): string {
  return String(number).padStart(3, '0')
}
