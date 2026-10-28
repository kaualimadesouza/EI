import { findProduct } from '../../domain/menu'
import { displayNumber, type OrderDraft, type OrderSummary, type PlacedOrder } from '../../domain/order'
import { canMove, STATUS_LABEL } from '../../domain/status'
import type { MenuPort } from '../../ports/menu'
import { OrderRejectedError, type OrdersPort } from '../../ports/orders'
import { browserStorage, StoredValue, type KeyValueStore } from './browser-storage'

interface StoredOrder extends OrderSummary {
  businessDate: string
  /** The demo kitchen's moment to turn this phone order ready; gone once it has run. */
  readyAt?: string
}

// the demo kitchen: with no merchant at a dashboard, a phone order is ready this long after payment
const DEMO_KITCHEN_MS = 5_000

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
    const orders = this.stored()
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
      // a totem order waits for the dashboard, as it always has
      readyAt: draft.placedOn === 'phone' ? new Date(createdAt.getTime() + DEMO_KITCHEN_MS).toISOString() : undefined,
    }
    this.orders.write([...orders, order])
    return { id: order.id, number: order.number, totalCents: order.totalCents, businessDate }
  }

  list(businessDate: string): Promise<OrderSummary[]> {
    return Promise.resolve(this.stored().filter((order) => order.businessDate === businessDate))
  }

  statusOf(placed: PlacedOrder): Promise<OrderSummary['status']> {
    const order = this.stored().find((o) => o.id === placed.id)
    return order ? Promise.resolve(order.status) : Promise.reject(new OrderRejectedError('Pedido não encontrado.'))
  }

  setStatus(orderId: string, status: OrderSummary['status']): Promise<OrderSummary> {
    const orders = this.stored()
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

  // whichever tab reads first (the phone or the dashboard) runs the demo kitchen, once per order
  private stored(): StoredOrder[] {
    const now = this.now().getTime()
    let cooked = false
    const orders = this.orders.read().map((order): StoredOrder => {
      if (!order.readyAt || Date.parse(order.readyAt) > now) return order
      cooked = true
      const waiting = order.status === 'received' || order.status === 'preparing'
      return { ...order, status: waiting ? 'ready' : order.status, readyAt: undefined }
    })
    if (cooked) this.orders.write(orders)
    return orders
  }
}
