import { DEMO_CATALOG } from '../../domain/demo-catalog'
import { findProduct, type Product } from '../../domain/menu'
import type { MenuPort } from '../../ports/menu'
import { browserStorage, StoredValue, type KeyValueStore } from './browser-storage'

/** The demo catalog plus what the dashboard marked sold out, shared by every tab of this browser. */
export class LocalMenu implements MenuPort {
  private readonly soldOut: StoredValue<string[]>

  constructor(storage: KeyValueStore | null = browserStorage()) {
    this.soldOut = new StoredValue<string[]>(storage, 'topa.sold-out', [])
  }

  list(): Promise<Product[]> {
    const soldOut = this.soldOut.read()
    return Promise.resolve(DEMO_CATALOG.map((product) => ({ ...product, available: !soldOut.includes(product.id) })))
  }

  setAvailability(productId: string, available: boolean): Promise<Product> {
    const product = findProduct(DEMO_CATALOG, productId)
    if (!product) return Promise.reject(new Error(`No product ${productId} in the demo catalog`))
    const others = this.soldOut.read().filter((id) => id !== productId)
    this.soldOut.write(available ? others : [...others, productId])
    return Promise.resolve({ ...product, available })
  }
}
