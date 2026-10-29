import type { Product } from '../../domain/menu'
import type { StoreMenu } from '../../domain/store'
import { StoreNotFoundError, type MenuPort } from '../../ports/menu'
import type { HttpClient } from './http-client'

interface ProductJson {
  id: string
  name: string
  description: string
  category: Product['category']
  price_cents: number
  available: boolean
}

interface StoreMenuJson {
  store: { slug: string; name: string }
  products: ProductJson[]
}

interface ErrorJson {
  detail?: unknown
}

function toProduct(row: ProductJson): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    priceCents: row.price_cents,
    available: row.available,
  }
}

export class HttpMenu implements MenuPort {
  private readonly client: HttpClient

  constructor(client: HttpClient) {
    this.client = client
  }

  async load(storeSlug: string): Promise<StoreMenu> {
    const response = await this.client.get(`/menu?loja=${encodeURIComponent(storeSlug)}`)
    if (response.status === 404) {
      const body = (await response.json()) as ErrorJson
      throw new StoreNotFoundError(typeof body.detail === 'string' ? body.detail : undefined)
    }
    if (!response.ok) throw new Error(`GET /menu answered ${response.status}`)
    const body = (await response.json()) as StoreMenuJson
    return {
      store: { slug: body.store.slug, name: body.store.name },
      products: body.products.map(toProduct),
    }
  }

  async setAvailability(productId: string, available: boolean, storeSlug: string): Promise<Product> {
    const path = `/products/${encodeURIComponent(productId)}?loja=${encodeURIComponent(storeSlug)}`
    const response = await this.client.patch(path, { available })
    if (!response.ok) throw new Error(`PATCH /products/${productId} answered ${response.status}`)
    return toProduct((await response.json()) as ProductJson)
  }
}
