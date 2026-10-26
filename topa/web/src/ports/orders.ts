import type { OrderDraft, OrderSummary, PlacedOrder } from '../domain/order'

export interface OrdersPort {
  place(draft: OrderDraft): Promise<PlacedOrder>
  /** One business day (YYYY-MM-DD, store time), in order-number order. */
  list(businessDate: string): Promise<OrderSummary[]>
  /** One step forward through the kitchen, or one back to undo. */
  setStatus(orderId: string, status: OrderSummary['status']): Promise<OrderSummary>
}

/** The store refused the request (an item sold out, a status that cannot follow); the message is for people. */
export class OrderRejectedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrderRejectedError'
  }
}
