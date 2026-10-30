import { useCallback, useEffect, useState } from 'react'

import { formatBRL } from '../../domain/menu'
import { displayNumber, type OrderSummary } from '../../domain/order'
import { STATUS_LABEL } from '../../domain/status'
import type { AuthenticatedCustomer } from '../../ports/customer-auth'
import type { OrdersPort } from '../../ports/orders'
import type { StoresPort, StoreSummary } from '../../ports/stores'
import { LogoutIcon, StoreMark } from '../icons'

export interface StoreSelectorScreenProps {
  stores: StoresPort
  orders: OrdersPort
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

function statusBadge(status: OrderSummary['status']) {
  switch (status) {
    case 'received':
      return {
        label: STATUS_LABEL.received,
        badgeClass: 'bg-ground-2 text-muted border-line',
        dotClass: 'bg-muted',
      }
    case 'preparing':
      return {
        label: STATUS_LABEL.preparing,
        badgeClass: 'bg-warning-tint text-warning border-warning/30',
        dotClass: 'bg-warning animate-pulse',
      }
    case 'ready':
      return {
        label: STATUS_LABEL.ready,
        badgeClass: 'bg-sage-tint text-teal border-teal/30',
        dotClass: 'bg-teal',
      }
    case 'delivered':
      return {
        label: STATUS_LABEL.delivered,
        badgeClass: 'bg-cream text-muted border-line',
        dotClass: 'bg-muted',
      }
  }
}

function formatOrderDate(isoString: string): string {
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) {
    return isoString
  }
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Store selector screen displaying available restaurants and customer order history. */
export function StoreSelectorScreen({
  stores,
  orders,
  customer,
  onSelectStore,
  onLogout,
}: StoreSelectorScreenProps) {
  const [activeTab, setActiveTab] = useState<'stores' | 'orders'>('stores')
  const [storeList, setStoreList] = useState<StoreSummary[]>([])
  const [loadingStores, setLoadingStores] = useState(true)
  const [storesError, setStoresError] = useState<string | null>(null)

  const [ordersList, setOrdersList] = useState<OrderSummary[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [ordersError, setOrdersError] = useState<string | null>(null)

  const loadStores = useCallback(async () => {
    setLoadingStores(true)
    setStoresError(null)
    try {
      const items = await stores.listAll()
      setStoreList(items)
    } catch {
      setStoresError('Não foi possível carregar a lista de restaurantes.')
    } finally {
      setLoadingStores(false)
    }
  }, [stores])

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true)
    setOrdersError(null)
    try {
      const items = await orders.listCustomerOrders()
      setOrdersList(items)
    } catch {
      setOrdersError('Não foi possível carregar o histórico de pedidos.')
    } finally {
      setLoadingOrders(false)
    }
  }, [orders])

  useEffect(() => {
    void loadStores()
  }, [loadStores])

  useEffect(() => {
    if (activeTab === 'orders') {
      void loadOrders()
    }
  }, [activeTab, loadOrders])

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
        <div className="mb-4">
          <h1 className="text-[26px] font-bold tracking-tight">
            {activeTab === 'stores' ? 'Onde você quer pedir hoje?' : 'Meus Pedidos'}
          </h1>
          <p className="mt-1 text-[15px] text-muted">
            {activeTab === 'stores'
              ? 'Escolha um dos restaurantes da praça para abrir o cardápio e fazer seu pedido.'
              : 'Acompanhe o status e histórico dos seus pedidos em todos os restaurantes.'}
          </p>
        </div>

        <div className="mb-6 flex gap-2 border-b border-line pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('stores')}
            className={`cursor-pointer rounded-[12px] px-4 py-2 text-[14px] font-semibold transition ${
              activeTab === 'stores' ? 'bg-ink text-white' : 'bg-surface text-muted hover:text-ink'
            }`}
          >
            Restaurantes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`cursor-pointer rounded-[12px] px-4 py-2 text-[14px] font-semibold transition ${
              activeTab === 'orders' ? 'bg-ink text-white' : 'bg-surface text-muted hover:text-ink'
            }`}
          >
            Meus Pedidos
          </button>
        </div>

        {activeTab === 'stores' && (
          <>
            {loadingStores && (
              <div className="flex flex-1 items-center justify-center py-16">
                <p className="text-[15px] font-medium text-muted">Carregando restaurantes...</p>
              </div>
            )}

            {storesError && (
              <div
                role="alert"
                className="flex flex-col items-center justify-center gap-3 rounded-[16px] border border-line bg-surface p-8 text-center"
              >
                <p className="text-[15px] font-medium text-warning">{storesError}</p>
                <button
                  type="button"
                  onClick={() => void loadStores()}
                  className="cursor-pointer rounded-[10px] bg-ink px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-ink/90"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!loadingStores && !storesError && (
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
          </>
        )}

        {activeTab === 'orders' && (
          <>
            {loadingOrders && (
              <div className="flex flex-1 items-center justify-center py-16">
                <p className="text-[15px] font-medium text-muted">Carregando pedidos...</p>
              </div>
            )}

            {ordersError && (
              <div
                role="alert"
                className="flex flex-col items-center justify-center gap-3 rounded-[16px] border border-line bg-surface p-8 text-center"
              >
                <p className="text-[15px] font-medium text-warning">{ordersError}</p>
                <button
                  type="button"
                  onClick={() => void loadOrders()}
                  className="cursor-pointer rounded-[10px] bg-ink px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-ink/90"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!loadingOrders && !ordersError && ordersList.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] border border-line bg-surface py-16 px-6 text-center">
                <p className="text-[18px] font-bold text-ink">Nenhum pedido realizado</p>
                <p className="max-w-[36ch] text-[14px] text-muted">
                  Você ainda não fez nenhum pedido. Escolha um dos restaurantes da praça para começar.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('stores')}
                  className="mt-2 cursor-pointer rounded-[12px] bg-ink px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-ink/90"
                >
                  Ver restaurantes
                </button>
              </div>
            )}

            {!loadingOrders && !ordersError && ordersList.length > 0 && (
              <div className="flex flex-col gap-4">
                {ordersList.map((order) => {
                  const matchedStore = storeList.find((s) => s.slug === order.storeSlug)
                  const storeName = matchedStore?.name ?? order.storeSlug ?? 'Restaurante'
                  const statusInfo = statusBadge(order.status)

                  return (
                    <article
                      key={order.id}
                      aria-label={`Pedido ${displayNumber(order.number)}`}
                      className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-6 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                        <div>
                          <span className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                            {storeName}
                          </span>
                          <h3 className="text-[20px] font-bold tabular-nums text-ink">
                            Pedido #{displayNumber(order.number)}
                          </h3>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold ${statusInfo.badgeClass}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${statusInfo.dotClass}`} />
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
                        <span>{formatOrderDate(order.createdAt)}</span>
                        <div className="flex items-center gap-2">
                          <span>{order.dineIn ? 'Comer no local' : 'Para viagem'}</span>
                          <span>(</span>
                          <span>{order.paymentMethod === 'pix' ? 'PIX' : 'Cartão'}</span>
                          <span>)</span>
                        </div>
                      </div>

                      <ul className="flex flex-col gap-1 border-y border-line py-3 text-[14px]">
                        {order.items.map((item, idx) => (
                          <li key={idx} className="flex items-center justify-between">
                            <span className="text-ink">
                              <span className="font-semibold tabular-nums">{item.quantity}×</span> {item.name}
                            </span>
                            <span className="tabular-nums text-muted">
                              {formatBRL(item.quantity * item.unitPriceCents)}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[14px] font-medium text-muted">Total pago</span>
                        <span className="text-[18px] font-bold tabular-nums text-ink">
                          {formatBRL(order.totalCents)}
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
