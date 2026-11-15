export interface StoreSummary {
  slug: string
  name: string
  latitude?: number
  longitude?: number
  address?: string
  category?: string
  segment?: 'restaurant' | 'market'
  acceptingOrders?: boolean
}

export interface StoresPort {
  listAll(): Promise<StoreSummary[]>
  setAcceptingOrders(storeSlug: string, accepting: boolean): Promise<boolean>
}
