import { DEMO_CATALOG } from '../../domain/demo-catalog'
import { findProduct, type Product } from '../../domain/menu'
import { DEMO_STORE_NAME, DEMO_STORE_SLUG, type StoreMenu } from '../../domain/store'
import {
  type CreateProductDraft,
  type MenuPort,
  StoreNotFoundError,
  type UpdateProductDraft,
} from '../../ports/menu'
import { browserStorage, StoredValue, type KeyValueStore } from './browser-storage'

/** The demo store plus what the dashboard marked sold out or configured, shared by every tab of this browser. */
export class LocalMenu implements MenuPort {
  private readonly soldOut: StoredValue<string[]>
  private readonly customProducts: StoredValue<Product[]>

  constructor(storage: KeyValueStore | null = browserStorage()) {
    this.soldOut = new StoredValue<string[]>(storage, 'topa.sold-out', [])
    this.customProducts = new StoredValue<Product[]>(storage, 'topa.custom-products', [])
  }

  private allProducts(): Product[] {
    const custom = this.customProducts.read()
    const customMap = new Map(custom.map((p) => [p.id, p]))
    const base = DEMO_CATALOG.map((p) => customMap.get(p.id) ?? p)
    const extra = custom.filter((p) => !DEMO_CATALOG.some((d) => d.id === p.id))
    return [...base, ...extra]
  }

  load(storeSlug: string): Promise<StoreMenu> {
    if (storeSlug !== DEMO_STORE_SLUG) return Promise.reject(new StoreNotFoundError())
    const soldOut = this.soldOut.read()
    return Promise.resolve({
      store: { slug: DEMO_STORE_SLUG, name: DEMO_STORE_NAME },
      products: this.allProducts().map((product) => ({ ...product, available: !soldOut.includes(product.id) })),
    })
  }

  setAvailability(productId: string, available: boolean, storeSlug: string): Promise<Product> {
    if (storeSlug !== DEMO_STORE_SLUG) return Promise.reject(new StoreNotFoundError())
    const product = findProduct(this.allProducts(), productId)
    if (!product) return Promise.reject(new Error(`No product ${productId} in the demo catalog`))
    const others = this.soldOut.read().filter((id) => id !== productId)
    this.soldOut.write(available ? others : [...others, productId])
    return Promise.resolve({ ...product, available })
  }

  create(draft: CreateProductDraft, storeSlug: string): Promise<Product> {
    if (storeSlug !== DEMO_STORE_SLUG) return Promise.reject(new StoreNotFoundError())
    const id = draft.id?.trim() || draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `p-${Date.now()}`
    const existing = findProduct(this.allProducts(), id)
    if (existing) return Promise.reject(new Error('Produto já cadastrado.'))
    const newProduct: Product = {
      id,
      name: draft.name,
      description: draft.description,
      category: draft.category,
      priceCents: draft.priceCents,
      photoUrl: draft.photoUrl,
      available: draft.available ?? true,
    }
    this.customProducts.write([...this.customProducts.read(), newProduct])
    if (newProduct.available === false) {
      this.soldOut.write([...this.soldOut.read(), id])
    }
    return Promise.resolve(newProduct)
  }

  update(productId: string, draft: UpdateProductDraft, storeSlug: string): Promise<Product> {
    if (storeSlug !== DEMO_STORE_SLUG) return Promise.reject(new StoreNotFoundError())
    const existing = findProduct(this.allProducts(), productId)
    if (!existing) return Promise.reject(new Error('Produto não encontrado.'))
    const updated: Product = {
      ...existing,
      name: draft.name,
      description: draft.description,
      category: draft.category,
      priceCents: draft.priceCents,
      photoUrl: draft.photoUrl,
      available: draft.available ?? existing.available,
    }
    const filtered = this.customProducts.read().filter((p) => p.id !== productId)
    this.customProducts.write([...filtered, updated])
    if (draft.available !== undefined) {
      const others = this.soldOut.read().filter((x) => x !== productId)
      this.soldOut.write(draft.available ? others : [...others, productId])
    }
    return Promise.resolve(updated)
  }
}
