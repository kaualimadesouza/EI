import type { OrderDraft, PlacedOrder } from '../domain/order'

export interface OrdersPort {
  place(draft: OrderDraft): Promise<PlacedOrder>
}

/** The store refused the order (say, an item sold out meanwhile); the message is for the customer. */
export class OrderRejectedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrderRejectedError'
  }
}
