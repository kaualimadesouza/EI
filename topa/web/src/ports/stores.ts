export interface StoreSummary {
  slug: string
  name: string
  latitude?: number
  longitude?: number
  address?: string
  category?: string
}

export interface StoresPort {
  listAll(): Promise<StoreSummary[]>
}
