import type { OrderDraft, OrderSummary, PlacedOrder } from '../../domain/order'
import { OrderRejectedError, type OrdersPort } from '../../ports/orders'
import type { HttpClient } from './http-client'

interface OrderJson {
  id: string
  number: number
  status: OrderSummary['status']
  dine_in: boolean
  payment_method: OrderSummary['paymentMethod']
  total_cents: number
  created_at: string
  items: { product_id: string; name: string; quantity: number; unit_price_cents: number }[]
}

interface ErrorJson {
  detail?: unknown
}

function toSummary(order: OrderJson): OrderSummary {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    dineIn: order.dine_in,
    paymentMethod: order.payment_method,
    totalCents: order.total_cents,
    createdAt: order.created_at,
    items: order.items.map((item) => ({
      productId: item.product_id,
      name: item.name,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
    })),
  }
}

// the API words a refusal for people; pydantic's own 422 is a list, not a sentence
async function refusal(response: Response, fallback: string): Promise<OrderRejectedError> {
  const body = (await response.json()) as ErrorJson
  return new OrderRejectedError(typeof body.detail === 'string' ? body.detail : fallback)
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
      throw await refusal(response, 'Não foi possível registrar o pedido.')
    }
    if (!response.ok) throw new Error(`POST /orders answered ${response.status}`)
    const order = (await response.json()) as OrderJson
    return { id: order.id, number: order.number, totalCents: order.total_cents }
  }

  async list(businessDate: string): Promise<OrderSummary[]> {
    const response = await this.client.get(`/orders?date=${businessDate}`)
    if (!response.ok) throw new Error(`GET /orders answered ${response.status}`)
    return ((await response.json()) as OrderJson[]).map(toSummary)
  }

  async statusOf(orderId: string): Promise<OrderSummary['status']> {
    const path = `/orders/${encodeURIComponent(orderId)}`
    const response = await this.client.get(path)
    if (!response.ok) throw new Error(`GET ${path} answered ${response.status}`)
    return ((await response.json()) as OrderJson).status
  }

  async setStatus(orderId: string, status: OrderSummary['status']): Promise<OrderSummary> {
    const response = await this.client.patch(`/orders/${encodeURIComponent(orderId)}`, { status })
    if (response.status === 404 || response.status === 409) {
      throw await refusal(response, 'Não foi possível mudar o pedido.')
    }
    if (!response.ok) throw new Error(`PATCH /orders/${orderId} answered ${response.status}`)
    return toSummary((await response.json()) as OrderJson)
  }
}
