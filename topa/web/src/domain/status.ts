import type { OrderSummary } from './order'

const FLOW: readonly OrderSummary['status'][] = ['received', 'preparing', 'ready', 'delivered']

export const STATUS_LABEL: Record<OrderSummary['status'], string> = {
  received: 'Recebido',
  preparing: 'Em preparo',
  ready: 'Pronto',
  delivered: 'Entregue',
}

export function nextStatus(status: OrderSummary['status']): OrderSummary['status'] | null {
  return FLOW[FLOW.indexOf(status) + 1] ?? null
}

export function previousStatus(status: OrderSummary['status']): OrderSummary['status'] | null {
  return FLOW[FLOW.indexOf(status) - 1] ?? null
}

/** One step forward, or one step back for the dashboard's undo; the API enforces the same rule. */
export function canMove(from: OrderSummary['status'], to: OrderSummary['status']): boolean {
  return Math.abs(FLOW.indexOf(from) - FLOW.indexOf(to)) === 1
}
