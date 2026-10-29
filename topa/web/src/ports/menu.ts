import type { Product } from '../domain/menu'
import type { Store } from '../domain/store'

export interface StoreMenu {
  store: Store
  products: Product[]
}

export interface MenuPort {
  load(storeSlug: string): Promise<StoreMenu>
  /** Sold out or back on sale; the totems pick it up at their next customer. */
  setAvailability(productId: string, available: boolean, storeSlug: string): Promise<Product>
}

/** No store has that slug; the message is for people. */
export class StoreNotFoundError extends Error {
  constructor(message = 'Loja não encontrada.') {
    super(message)
    this.name = 'StoreNotFoundError'
  }
}
