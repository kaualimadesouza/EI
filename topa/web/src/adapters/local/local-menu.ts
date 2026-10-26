import type { Product } from '../../domain/menu'
import type { MenuPort } from '../../ports/menu'
import { DEMO_CATALOG } from '../../domain/demo-catalog'

export class LocalMenu implements MenuPort {
  list(): Promise<Product[]> {
    return Promise.resolve(DEMO_CATALOG.map((product) => ({ ...product })))
  }
}
