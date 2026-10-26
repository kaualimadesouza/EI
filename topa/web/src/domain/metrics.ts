import type { OrderSummary } from './order'

export interface HourCount {
  hour: number
  count: number
}

export interface DayMetrics {
  revenueCents: number
  orderCount: number
  averageTicketCents: number
  takeAwayShare: number
  byHour: HourCount[]
}

const OPENING_HOUR = 7
const CLOSING_HOUR = 22

/** The day's numbers, computed the same way whether the orders came from the API or the browser. */
export function metricsOf(orders: readonly OrderSummary[]): DayMetrics {
  const revenueCents = orders.reduce((sum, order) => sum + order.totalCents, 0)
  const orderCount = orders.length
  const byHour: HourCount[] = []
  for (let hour = OPENING_HOUR; hour <= CLOSING_HOUR; hour++) byHour.push({ hour, count: 0 })
  for (const order of orders) {
    const hour = new Date(order.createdAt).getHours()
    const slot = byHour.find((h) => h.hour === hour)
    if (slot) slot.count += 1
  }
  return {
    revenueCents,
    orderCount,
    averageTicketCents: orderCount === 0 ? 0 : Math.round(revenueCents / orderCount),
    takeAwayShare: orderCount === 0 ? 0 : orders.filter((o) => !o.dineIn).length / orderCount,
    byHour,
  }
}

/** Relative change against a previous value, or null when there is nothing to compare with. */
export function changeRatio(current: number, previous: number): number | null {
  return previous === 0 ? null : (current - previous) / previous
}
