import type { Product } from '../../domain/menu'
import type { StoreMenu } from '../../domain/store'
import {
  type CreateProductDraft,
  type MenuPort,
  StoreNotFoundError,
  type UpdateProductDraft,
} from '../../ports/menu'
import type { HttpClient } from './http-client'

interface ProductJson {
  id: string
  name: string
  description: string
  category: string
  price_cents: number
  available: boolean
  photo_url?: string | null
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
    photoUrl: row.photo_url ?? undefined,
  }
}

export class HttpMenu implements MenuPort {
  private readonly client: HttpClient
  private readonly tokenProvider?: () => string | null

  constructor(client: HttpClient, tokenProvider?: () => string | null) {
    this.client = client
    this.tokenProvider = tokenProvider
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
    const response = await this.client.patch(path, { available }, this.tokenProvider?.())
    if (!response.ok) throw new Error(`PATCH /products/${productId} answered ${response.status}`)
    return toProduct((await response.json()) as ProductJson)
  }

  async create(draft: CreateProductDraft, storeSlug: string): Promise<Product> {
    const path = `/products?loja=${encodeURIComponent(storeSlug)}`
    const body = {
      id: draft.id,
      name: draft.name,
      description: draft.description,
      category: draft.category,
      price_cents: draft.priceCents,
      photo_url: draft.photoUrl ?? null,
      available: draft.available ?? true,
    }
    const response = await this.client.post(path, body, this.tokenProvider?.())
    if (!response.ok) throw new Error(`POST /products answered ${response.status}`)
    return toProduct((await response.json()) as ProductJson)
  }

  async update(productId: string, draft: UpdateProductDraft, storeSlug: string): Promise<Product> {
    const path = `/products/${encodeURIComponent(productId)}?loja=${encodeURIComponent(storeSlug)}`
    const body = {
      name: draft.name,
      description: draft.description,
      category: draft.category,
      price_cents: draft.priceCents,
      photo_url: draft.photoUrl ?? null,
      available: draft.available,
    }
    const response = await this.client.put(path, body, this.tokenProvider?.())
    if (!response.ok) throw new Error(`PUT /products/${productId} answered ${response.status}`)
    return toProduct((await response.json()) as ProductJson)
  }
}
