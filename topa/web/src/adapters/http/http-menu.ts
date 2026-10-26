import type { Product } from '../../domain/menu'
import type { MenuPort } from '../../ports/menu'
import type { HttpClient } from './http-client'

interface ProductJson {
  id: string
  name: string
  description: string
  category: Product['category']
  price_cents: number
  available: boolean
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

  async list(): Promise<Product[]> {
    const response = await this.client.get('/products')
    if (!response.ok) throw new Error(`GET /products answered ${response.status}`)
    return ((await response.json()) as ProductJson[]).map(toProduct)
  }

  async setAvailability(productId: string, available: boolean): Promise<Product> {
    const response = await this.client.patch(`/products/${encodeURIComponent(productId)}`, { available })
    if (!response.ok) throw new Error(`PATCH /products/${productId} answered ${response.status}`)
    return toProduct((await response.json()) as ProductJson)
  }
}
