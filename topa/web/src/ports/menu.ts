import type { Product } from '../domain/menu'
import type { StoreMenu } from '../domain/store'

export interface CreateProductDraft {
  id?: string
  name: string
  description: string
  category: string
  priceCents: number
  photoUrl?: string
  available?: boolean
}

export interface UpdateProductDraft {
  name: string
  description: string
  category: string
  priceCents: number
  photoUrl?: string
  available?: boolean
}

export interface MenuPort {
  load(storeSlug: string): Promise<StoreMenu>
  /** Sold out or back on sale; the totems pick it up at their next customer. */
  setAvailability(productId: string, available: boolean, storeSlug: string): Promise<Product>
  create(draft: CreateProductDraft, storeSlug: string): Promise<Product>
  update(productId: string, draft: UpdateProductDraft, storeSlug: string): Promise<Product>
}

/** No store has that slug; the message is for people. */
export class StoreNotFoundError extends Error {
  constructor(message = 'Loja não encontrada.') {
    super(message)
    this.name = 'StoreNotFoundError'
  }
}
