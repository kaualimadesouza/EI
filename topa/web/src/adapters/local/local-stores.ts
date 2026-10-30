import type { StoreSummary, StoresPort } from '../../ports/stores'

export const DEFAULT_STORES: StoreSummary[] = [
  { slug: 'lanchonete-bem-te-vi', name: 'Lanchonete Bem-te-vi' },
  { slug: 'brasa-burgers', name: 'Brasa Burgers' },
  { slug: 'bella-nonna', name: 'Cantina Bella Nonna' },
  { slug: 'acai-bowls', name: 'Açaí & Bowls Universitário' },
]

export interface LocalStoresOptions {
  stores?: StoreSummary[]
}

/** Local demo implementation of stores port. */
export class LocalStores implements StoresPort {
  private readonly stores: StoreSummary[]

  constructor(options: LocalStoresOptions = {}) {
    this.stores = options.stores ?? DEFAULT_STORES
  }

  async listAll(): Promise<StoreSummary[]> {
    return [...this.stores]
  }
}
