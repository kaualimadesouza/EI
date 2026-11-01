import type { StoreSummary, StoresPort } from '../../ports/stores'

export const DEFAULT_STORES: StoreSummary[] = [
  {
    slug: 'lanchonete-bem-te-vi',
    name: 'Lanchonete Bem-te-vi',
    latitude: -23.4823,
    longitude: -46.5012,
    address: 'Praça Central - Bloco A',
    category: 'Lanches Tradicionais',
    segment: 'restaurant',
  },
  {
    slug: 'brasa-burgers',
    name: 'Brasa Burgers',
    latitude: -23.4828,
    longitude: -46.5005,
    address: 'Praça de Alimentação - Quiosque 4',
    category: 'Burgers & Grill',
    segment: 'restaurant',
  },
  {
    slug: 'bella-nonna',
    name: 'Cantina Bella Nonna',
    latitude: -23.4815,
    longitude: -46.502,
    address: 'Boulevard Acadêmico - Bloco B',
    category: 'Culinária Italiana',
    segment: 'restaurant',
  },
  {
    slug: 'acai-bowls',
    name: 'Açaí & Bowls Universitário',
    latitude: -23.4835,
    longitude: -46.4998,
    address: 'Centro de Convivência Esportiva',
    category: 'Saudável & Bowls',
    segment: 'restaurant',
  },
  {
    slug: 'emporio-campus',
    name: 'Empório do Campus Express',
    latitude: -23.482,
    longitude: -46.5008,
    address: 'Vivência Central - Bloco C',
    category: 'Mercado Express',
    segment: 'market',
  },
  {
    slug: 'conveniencia-central',
    name: 'Conveniência & Bebidas 24h',
    latitude: -23.483,
    longitude: -46.5018,
    address: 'Acesso Portaria Principal',
    category: 'Conveniência & Bebidas',
    segment: 'market',
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
