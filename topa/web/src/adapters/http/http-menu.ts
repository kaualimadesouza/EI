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

export class HttpMenu implements MenuPort {
  private readonly client: HttpClient

  constructor(client: HttpClient) {
    this.client = client
  }

  async list(): Promise<Product[]> {
    const response = await this.client.get('/products')
    if (!response.ok) throw new Error(`GET /products answered ${response.status}`)
    const rows = (await response.json()) as ProductJson[]
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      priceCents: row.price_cents,
      available: row.available,
    }))
  }
}
