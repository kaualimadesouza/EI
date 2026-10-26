import { describe, expect, it } from 'vitest'

import { metricsOf } from './metrics'
import type { OrderSummary } from './order'

function order(number: number, totalCents: number, hour: number, dineIn = true): OrderSummary {
  return {
    id: `id-${number}`,
    number,
    status: 'received',
    dineIn,
    paymentMethod: 'card',
    totalCents,
    createdAt: new Date(2026, 9, 26, hour, 15).toISOString(),
    items: [],
  }
}

describe('metricsOf', () => {
  it('sums revenue, averages the ticket and measures take-away share', () => {
    const metrics = metricsOf([order(1, 1000, 8), order(2, 2001, 12, false), order(3, 3000, 12)])

    expect(metrics.revenueCents).toBe(6001)
    expect(metrics.orderCount).toBe(3)
    expect(metrics.averageTicketCents).toBe(2000)
    expect(metrics.takeAwayShare).toBeCloseTo(1 / 3)
  })

  it('counts orders per store hour, from opening to closing', () => {
    const { byHour } = metricsOf([order(1, 100, 8), order(2, 100, 12), order(3, 100, 12), order(4, 100, 3)])

    expect(byHour[0]).toEqual({ hour: 7, count: 0 })
    expect(byHour.at(-1)).toEqual({ hour: 22, count: 0 })
    expect(byHour.find((h) => h.hour === 8)?.count).toBe(1)
    expect(byHour.find((h) => h.hour === 12)?.count).toBe(2)
    expect(byHour.reduce((sum, h) => sum + h.count, 0)).toBe(3)
  })

  it('reports zeros for a day with no orders', () => {
    expect(metricsOf([])).toMatchObject({ revenueCents: 0, orderCount: 0, averageTicketCents: 0, takeAwayShare: 0 })
  })
})
