import { describe, expect, it } from 'vitest'

import { ageMinutes, displayNumber, type OrderSummary } from './order'

const placedAt = (createdAt: string): OrderSummary => ({
  id: 'a',
  number: 7,
  status: 'received',
  dineIn: true,
  paymentMethod: 'pix',
  totalCents: 100,
  createdAt,
  items: [],
})

describe('displayNumber', () => {
  it('pads to the three digits the counter screen shows', () => {
    expect(displayNumber(7)).toBe('007')
    expect(displayNumber(1203)).toBe('1203')
  })
})

describe('ageMinutes', () => {
  it('counts whole minutes since the order was placed', () => {
    const now = new Date('2026-10-26T15:10:59Z')

    expect(ageMinutes(placedAt('2026-10-26T15:00:00Z'), now)).toBe(10)
  })

  it('never goes negative when the kiosk clock runs ahead of the dashboard', () => {
    expect(ageMinutes(placedAt('2026-10-26T15:02:00Z'), new Date('2026-10-26T15:00:00Z'))).toBe(0)
  })
})
