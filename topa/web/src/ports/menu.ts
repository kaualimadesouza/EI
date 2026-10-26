import type { Product } from '../domain/menu'

export interface MenuPort {
  list(): Promise<Product[]>
}
