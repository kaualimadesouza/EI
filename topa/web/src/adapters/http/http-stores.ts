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
  accepting_orders?: boolean
}

/** HTTP implementation of stores port. */
export class HttpStores implements StoresPort {
  private readonly client: HttpClient
  private readonly tokenProvider?: () => string | null

  constructor(client: HttpClient, tokenProvider?: () => string | null) {
    this.client = client
    this.tokenProvider = tokenProvider
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
      acceptingOrders: item.accepting_orders,
    }))
  }

  async setAcceptingOrders(storeSlug: string, accepting: boolean): Promise<boolean> {
    const response = await this.client.patch(`/stores/${encodeURIComponent(storeSlug)}/ordering`,
      { accepting_orders: accepting }, this.tokenProvider?.()).catch(() => {
        throw new Error('Não foi possível alterar o recebimento de pedidos. Tente de novo.')
      })
    if (!response.ok) {
      let message = 'Não foi possível alterar o recebimento de pedidos. Tente de novo.'
      try {
        const body = await response.json() as { detail?: string }
        if (body.detail) message = body.detail
      } catch { /* Keep the action the owner can take when the server has no readable body. */ }
      throw new Error(message)
    }
    return ((await response.json()) as { accepting_orders: boolean }).accepting_orders
  }
}
