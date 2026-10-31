import type { OrderDraft, OrderSummary, PlacedOrder } from '../domain/order'

export interface OrdersPort {
  place(draft: OrderDraft, clientOrderId?: string): Promise<PlacedOrder>
  /** One business day (YYYY-MM-DD, store time) for one store, in order-number order. */
  list(businessDate: string, storeSlug: string): Promise<OrderSummary[]>
  /** One step forward through the kitchen, or one back to undo. */
  setStatus(orderId: string, status: OrderSummary['status']): Promise<OrderSummary>
  /** Where one order is now; the customer's phone asks while its order screen is open. */
  statusOf(orderId: string): Promise<OrderSummary['status']>
  /** Orders placed by the authenticated customer across all stores. */
  listCustomerOrders(): Promise<OrderSummary[]>
  /** Live count of queued offline orders waiting to be synced. */
  getPendingSyncCount?(): number
  /** Subscribes to changes in the offline sync queue state. */
  subscribeSync?(listener: () => void): () => void
}

/** The store refused the request (an item sold out, a status that cannot follow); the message is for people. */
export class OrderRejectedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrderRejectedError'
  }
}
