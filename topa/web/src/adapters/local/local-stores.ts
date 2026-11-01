import type { StoreSummary, StoresPort } from '../../ports/stores'

export const DEFAULT_STORES: StoreSummary[] = [
  {
    slug: 'lanchonete-bem-te-vi',
    name: 'Lanchonete Bem-te-vi',
    latitude: -23.4823,
    longitude: -46.5012,
    address: 'Praça Central - Bloco A',
    category: 'Lanches Tradicionais',
  },
  {
    slug: 'brasa-burgers',
    name: 'Brasa Burgers',
    latitude: -23.4828,
    longitude: -46.5005,
    address: 'Praça de Alimentação - Quiosque 4',
    category: 'Burgers & Grill',
  },
  {
    slug: 'bella-nonna',
    name: 'Cantina Bella Nonna',
    latitude: -23.4815,
    longitude: -46.502,
    address: 'Boulevard Acadêmico - Bloco B',
    category: 'Culinária Italiana',
  },
  {
    slug: 'acai-bowls',
    name: 'Açaí & Bowls Universitário',
    latitude: -23.4835,
    longitude: -46.4998,
    address: 'Centro de Convivência Esportiva',
    category: 'Saudável & Bowls',
  },
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
