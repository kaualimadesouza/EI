import { findProduct } from '../../domain/menu'
import { displayNumber, type OrderDraft, type OrderSummary, type PlacedOrder } from '../../domain/order'
import { canMove, STATUS_LABEL } from '../../domain/status'
import type { MenuPort } from '../../ports/menu'
import { OrderRejectedError, type OrdersPort } from '../../ports/orders'
import { browserStorage, StoredValue, type KeyValueStore } from './browser-storage'

interface StoredOrder extends OrderSummary {
  businessDate: string
}

/** Demo mode keeps orders in this browser with the API's rules, so a kiosk tab and a dashboard tab agree. */
export class LocalOrders implements OrdersPort {
  private readonly menu: MenuPort
  private readonly orders: StoredValue<StoredOrder[]>
  private readonly now: () => Date

  constructor(menu: MenuPort, storage: KeyValueStore | null = browserStorage(), now: () => Date = () => new Date()) {
    this.menu = menu
    this.orders = new StoredValue<StoredOrder[]>(storage, 'topa.orders.v2', [])
    this.now = now
  }

  async place(draft: OrderDraft): Promise<PlacedOrder> {
    const products = await this.menu.list()
    const items = draft.lines.map((line) => {
      const product = findProduct(products, line.productId)
      if (!product) throw new OrderRejectedError('Um dos produtos não está mais no cardápio.')
      if (!product.available) throw new OrderRejectedError(`${product.name} esgotou.`)
      return { productId: product.id, name: product.name, quantity: line.quantity, unitPriceCents: product.priceCents }
    })
    const createdAt = this.now()
    const businessDate = createdAt.toLocaleDateString('sv-SE')
    const orders = this.orders.read()
    const order: StoredOrder = {
      id: crypto.randomUUID(),
      number: orders.filter((o) => o.businessDate === businessDate).length + 1,
      businessDate,
      status: 'received',
      dineIn: draft.dineIn,
      paymentMethod: draft.paymentMethod,
      totalCents: items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0),
      createdAt: createdAt.toISOString(),
      items,
    }
    this.orders.write([...orders, order])
    return { number: order.number, totalCents: order.totalCents }
  }

  list(businessDate: string): Promise<OrderSummary[]> {
    return Promise.resolve(this.orders.read().filter((order) => order.businessDate === businessDate))
  }

  setStatus(orderId: string, status: OrderSummary['status']): Promise<OrderSummary> {
    const orders = this.orders.read()
    const order = orders.find((o) => o.id === orderId)
    if (!order) return Promise.reject(new OrderRejectedError('Pedido não encontrado.'))
    if (!canMove(order.status, status)) {
      const from = STATUS_LABEL[order.status].toLowerCase()
      const to = STATUS_LABEL[status].toLowerCase()
      return Promise.reject(new OrderRejectedError(`O pedido ${displayNumber(order.number)} não pode passar de ${from} para ${to}.`))
    }
    const moved: StoredOrder = { ...order, status }
    this.orders.write(orders.map((o) => (o.id === orderId ? moved : o)))
    return Promise.resolve(moved)
  }
}
