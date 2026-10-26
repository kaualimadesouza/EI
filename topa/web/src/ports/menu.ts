import type { Product } from '../domain/menu'

export interface MenuPort {
  list(): Promise<Product[]>
  /** Sold out or back on sale; the totems pick it up at their next customer. */
  setAvailability(productId: string, available: boolean): Promise<Product>
}
