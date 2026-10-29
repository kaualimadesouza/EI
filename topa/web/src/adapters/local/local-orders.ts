import { findProduct } from '../../domain/menu'
import { displayNumber, type OrderDraft, type OrderSummary, type PlacedOrder } from '../../domain/order'
import { canMove, STATUS_LABEL } from '../../domain/status'
import { StoreNotFoundError, type MenuPort } from '../../ports/menu'
import { OrderRejectedError, type OrdersPort } from '../../ports/orders'
import { browserStorage, StoredValue, type KeyValueStore } from './browser-storage'

interface StoredOrder extends OrderSummary {
  storeSlug: string
  businessDate: string
}

// with no merchant at a dashboard, the demo kitchen has a followed order ready this long after payment
const DEMO_KITCHEN_MS = 5_000

/** Demo mode keeps orders in this browser with the API's rules, so a kiosk tab and a dashboard tab agree. */
export class LocalOrders implements OrdersPort {
  private readonly menu: MenuPort
  private readonly orders: StoredValue<StoredOrder[]>
  private readonly now: () => Date

  constructor(menu: MenuPort, storage: KeyValueStore | null = browserStorage(), now: () => Date = () => new Date()) {
    this.menu = menu
    this.orders = new StoredValue<StoredOrder[]>(storage, 'topa.orders.v3', [])
    this.now = now
  }

  async place(draft: OrderDraft): Promise<PlacedOrder> {
    const products = await this.menu.load(draft.storeSlug).then(
      (menu) => menu.products,
      (error: unknown) => {
        if (error instanceof StoreNotFoundError) throw new OrderRejectedError(error.message)
        throw error
      },
    )
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
      storeSlug: draft.storeSlug,
      number: orders.filter((o) => o.storeSlug === draft.storeSlug && o.businessDate === businessDate).length + 1,
      businessDate,
      status: 'received',
      dineIn: draft.dineIn,
      paymentMethod: draft.paymentMethod,
      totalCents: items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0),
      createdAt: createdAt.toISOString(),
      items,
    }
    this.orders.write([...orders, order])
    return { id: order.id, number: order.number, totalCents: order.totalCents }
  }

  list(businessDate: string, storeSlug: string): Promise<OrderSummary[]> {
    return Promise.resolve(
      this.orders.read().filter((order) => order.storeSlug === storeSlug && order.businessDate === businessDate),
    )
  }

  // only the customer's phone follows an order, so only a phone order is cooked; the totem's waits
  // for the dashboard, and so does any order the merchant has already taken from 'received'
  statusOf(orderId: string): Promise<OrderSummary['status']> {
    const orders = this.orders.read()
    const order = orders.find((o) => o.id === orderId)
    if (!order) return Promise.reject(new Error(`order ${orderId} is not in this browser`))
    const due = order.status === 'received' && this.now().getTime() - Date.parse(order.createdAt) >= DEMO_KITCHEN_MS
    if (!due) return Promise.resolve(order.status)
    this.orders.write(orders.map((o): StoredOrder => (o.id === orderId ? { ...o, status: 'ready' } : o)))
    return Promise.resolve('ready')
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
