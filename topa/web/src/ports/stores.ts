export interface StoreSummary {
  slug: string
  name: string
}

export interface StoresPort {
  listAll(): Promise<StoreSummary[]>
}
