import type { OrderDraft, PlacedOrder } from '../../domain/order'
import { OrderRejectedError, type OrdersPort } from '../../ports/orders'
import type { HttpClient } from './http-client'

interface PlacedOrderJson {
  number: number
  total_cents: number
}

interface ErrorJson {
  detail?: unknown
}

export class HttpOrders implements OrdersPort {
  private readonly client: HttpClient

  constructor(client: HttpClient) {
    this.client = client
  }

  async place(draft: OrderDraft): Promise<PlacedOrder> {
    const response = await this.client.post('/orders', {
      items: draft.lines.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
      dine_in: draft.dineIn,
      payment_method: draft.paymentMethod,
    })
    if (response.status === 409 || response.status === 422) {
      // the API words a refusal for the customer; pydantic's own 422 is a list, not a sentence
      const body = (await response.json()) as ErrorJson
      const message = typeof body.detail === 'string' ? body.detail : 'Não foi possível registrar o pedido.'
      throw new OrderRejectedError(message)
    }
    if (!response.ok) throw new Error(`POST /orders answered ${response.status}`)
    const order = (await response.json()) as PlacedOrderJson
    return { number: order.number, totalCents: order.total_cents }
  }
}
