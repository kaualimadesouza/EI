import type { StoreSummary, StoresPort } from '../../ports/stores'
import type { HttpClient } from './http-client'

interface StoreJson {
  slug: string
  name: string
  latitude?: number
  longitude?: number
  address?: string
  category?: string
  segment?: 'restaurant' | 'market'
}

/** HTTP implementation of stores port. */
export class HttpStores implements StoresPort {
  private readonly client: HttpClient

  constructor(client: HttpClient) {
    this.client = client
  }

  async listAll(): Promise<StoreSummary[]> {
    const response = await this.client.get('/stores', undefined, null)
    if (!response.ok) {
      throw new Error(`GET /stores answered ${response.status}`)
    }
    const data = (await response.json()) as StoreJson[]
    return data.map((item) => ({
      slug: item.slug,
      name: item.name,
      latitude: item.latitude,
      longitude: item.longitude,
      address: item.address,
      category: item.category,
      segment: item.segment,
    }))
  }
}
