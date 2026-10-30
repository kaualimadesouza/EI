import { useEffect, useState } from 'react'

import type { AuthenticatedCustomer } from '../../ports/customer-auth'
import type { StoresPort, StoreSummary } from '../../ports/stores'
import { LogoutIcon, StoreMark } from '../icons'

export interface StoreSelectorScreenProps {
  stores: StoresPort
  customer: AuthenticatedCustomer
  onSelectStore: (slug: string) => void
  onLogout: () => void
}

const STORE_DESCRIPTIONS: Record<string, { tag: string; description: string }> = {
  'brasa-burgers': {
    tag: 'Burgers & Grill',
    description: 'Hambúrgueres artesanais grelhados na brasa e acompanhamentos.',
  },
  'bella-nonna': {
    tag: 'Culinária Italiana',
    description: 'Massas artesanais frescas, lasanhas e molhos tradicionais.',
  },
  'acai-bowls': {
    tag: 'Saudável & Bowls',
    description: 'Açaí puro na tigela, smoothies e opções saudáveis do campus.',
  },
  'lanchonete-bem-te-vi': {
    tag: 'Lanches Tradicionais',
    description: 'Lanches rápidos, salgados assados e fritos, cafés e sobremesas.',
  },
}

/** Store selector screen displaying available restaurants for authenticated customers. */
export function StoreSelectorScreen({
  stores,
  customer,
  onSelectStore,
  onLogout,
}: StoreSelectorScreenProps) {
  const [storeList, setStoreList] = useState<StoreSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStores = async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await stores.listAll()
      setStoreList(items)
    } catch {
      setError('Não foi possível carregar a lista de restaurantes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStores()
  }, [])

  return (
    <div className="flex min-h-dvh flex-col bg-cream text-ink">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-line bg-surface/95 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <StoreMark size={36} />
          <div>
            <p className="text-[14px] font-bold">TOPA</p>
            <p className="text-[12px] text-muted">Olá, {customer.name}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          aria-label="Sair da conta"
          className="flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-line px-3 py-1.5 text-[13px] font-semibold text-muted transition hover:border-ink hover:text-ink"
        >
          <LogoutIcon size={16} />
          <span>Sair</span>
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col p-6">
        <div className="mb-6">
          <h1 className="text-[26px] font-bold tracking-tight">Onde você quer pedir hoje?</h1>
          <p className="mt-1 text-[15px] text-muted">
            Escolha um dos restaurantes da praça para abrir o cardápio e fazer seu pedido.
          </p>
        </div>

        {loading && (
          <div className="flex flex-1 items-center justify-center py-16">
            <p className="text-[15px] font-medium text-muted">Carregando restaurantes...</p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex flex-col items-center justify-center gap-3 rounded-[16px] border border-line bg-surface p-8 text-center"
          >
            <p className="text-[15px] font-medium text-warning">{error}</p>
            <button
              type="button"
              onClick={() => void loadStores()}
              className="cursor-pointer rounded-[10px] bg-ink px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-ink/90"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {storeList.map((store) => {
              const meta = STORE_DESCRIPTIONS[store.slug] ?? {
                tag: 'Restaurante',
                description: 'Cardápio completo disponível para pedidos imediatos.',
              }

              return (
                <article
                  key={store.slug}
                  className="flex flex-col justify-between rounded-[20px] border border-line bg-surface p-6 shadow-sm transition hover:shadow-md"
                >
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="rounded-full bg-cream px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                        {meta.tag}
                      </span>
                      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-teal">
                        <span className="h-2 w-2 rounded-full bg-teal" />
                        Aberto
                      </span>
                    </div>

                    <h2 className="text-[20px] font-bold text-ink">{store.name}</h2>
                    <p className="mt-2 text-[14px] leading-relaxed text-muted">
                      {meta.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectStore(store.slug)}
                    className="mt-6 flex h-11 w-full cursor-pointer items-center justify-center rounded-[12px] bg-ink text-[14px] font-semibold text-white transition hover:bg-ink/90"
                  >
                    Pedir em {store.name}
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
