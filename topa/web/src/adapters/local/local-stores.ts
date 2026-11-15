import type { MenuPort } from '../../ports/menu'
import { StoreNotFoundError } from '../../ports/menu'
import type { StoreSummary, StoresPort } from '../../ports/stores'
import { browserStorage, StoredValue, type KeyValueStore } from './browser-storage'
import { LocalMenu } from './local-menu'

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
  storage?: KeyValueStore | null
  menu?: MenuPort
}

/** Local demo implementation of stores port. */
export class LocalStores implements StoresPort {
  private readonly stores: StoreSummary[]
  private readonly storage: KeyValueStore | null
  private readonly ordering: StoredValue<Record<string, boolean>>
  private readonly menu: MenuPort

  constructor(options: LocalStoresOptions = {}) {
    this.stores = options.stores ?? DEFAULT_STORES
    this.storage = options.storage === undefined ? browserStorage() : options.storage
    this.ordering = new StoredValue(this.storage, 'topa.store-ordering', {})
    this.menu = options.menu ?? new LocalMenu(this.storage)
  }

  async listAll(): Promise<StoreSummary[]> {
    const ordering = this.ordering.read()
    return this.stores.map((store) => ({ ...store, acceptingOrders: ordering[store.slug] }))
  }

  async setAcceptingOrders(storeSlug: string, accepting: boolean): Promise<boolean> {
    if (!this.stores.some((store) => store.slug === storeSlug)) throw new StoreNotFoundError()
    const menu = await this.menu.load(storeSlug)
    if (accepting && !menu.products.some((product) => product.available)) {
      throw new Error('Cadastre pelo menos um produto à venda antes de abrir a loja.')
    }
    this.ordering.write({ ...this.ordering.read(), [storeSlug]: accepting })
    return accepting
  }
}
