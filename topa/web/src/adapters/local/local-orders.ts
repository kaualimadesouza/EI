import { totalCents } from '../../domain/cart'
import { findProduct } from '../../domain/menu'
import type { OrderDraft, PlacedOrder } from '../../domain/order'
import { OrderRejectedError, type OrdersPort } from '../../ports/orders'
import { DEMO_CATALOG } from '../../domain/demo-catalog'

export interface StoredOrder {
  number: number
  businessDate: string
  totalCents: number
  draft: OrderDraft
  status: 'received'
  createdAt: string
}

const KEY = 'topa.orders'

// reading localStorage itself throws in some sandboxed iframes
function browserStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

/** Demo mode keeps orders in this browser; storage can be missing or full, and the sale still goes on. */
export class LocalOrders implements OrdersPort {
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null
  private readonly now: () => Date
  private memory: StoredOrder[] = []

  constructor(
    storage: Pick<Storage, 'getItem' | 'setItem'> | null = browserStorage(),
    now: () => Date = () => new Date(),
  ) {
    this.storage = storage
    this.now = now
  }

  all(): StoredOrder[] {
    try {
      const raw = this.storage?.getItem(KEY)
      return raw ? (JSON.parse(raw) as StoredOrder[]) : this.memory
    } catch {
      return this.memory
    }
  }

  place(draft: OrderDraft): Promise<PlacedOrder> {
    const missing = draft.lines.find((line) => !findProduct(DEMO_CATALOG, line.productId))
    if (missing) return Promise.reject(new OrderRejectedError('Um item do pedido saiu do cardápio.'))
    const createdAt = this.now()
    const businessDate = createdAt.toLocaleDateString('sv-SE')
    const orders = this.all()
    const order: StoredOrder = {
      number: orders.filter((o) => o.businessDate === businessDate).length + 1,
      businessDate,
      totalCents: totalCents(draft.lines, DEMO_CATALOG),
      draft,
      status: 'received',
      createdAt: createdAt.toISOString(),
    }
    this.memory = [...orders, order]
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.memory))
    } catch {
      // quota or private mode: the order still lives in memory for this session
    }
    return Promise.resolve({ number: order.number, totalCents: order.totalCents })
  }
}
