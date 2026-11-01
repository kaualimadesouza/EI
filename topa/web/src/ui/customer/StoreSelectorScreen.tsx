import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  calculateDistanceMeters,
  type Coordinates,
  EACH_USP_COORDINATES,
  formatDistance,
  formatWalkingTime,
} from '../../domain/geo'
import { formatBRL } from '../../domain/menu'
import { displayNumber, type OrderSummary } from '../../domain/order'
import { STATUS_LABEL } from '../../domain/status'
import type { AuthenticatedCustomer } from '../../ports/customer-auth'
import type { OrdersPort } from '../../ports/orders'
import type { StoresPort, StoreSummary } from '../../ports/stores'
import {
  AlertIcon,
  CloseIcon,
  GoogleIcon,
  LogoutIcon,
  MarketIcon,
  PinIcon,
  SearchIcon,
  StoreMark,
} from '../icons'

export interface StoreSelectorScreenProps {
  stores: StoresPort
  orders: OrdersPort
  customer?: AuthenticatedCustomer | null
  sessionNotice?: string | null
  onSelectStore: (slug: string) => void
  onLoginRequest?: () => void
  onLogout?: () => void
}

const CATEGORY_CHIPS_RESTAURANTS = ['Todos', 'Mais Próximos', 'Burgers', 'Italiano', 'Saudável', 'Lanches']
const CATEGORY_CHIPS_MARKETS = ['Todos', 'Mais Próximos', 'Bebidas Geladas', 'Snacks & Doces', 'Mercearia Express', 'Conveniência']

const POLL_INTERVAL_MS = 5000

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
        dotClass: 'bg-warning motion-safe:animate-pulse',
      }
    case 'ready':
      return {
        label: STATUS_LABEL.ready,
        badgeClass: 'bg-sage-tint text-teal border-teal/30',
        dotClass: 'bg-teal motion-safe:animate-pulse',
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
  if (Number.isNaN(d.getTime())) return isoString
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function StoreSelectorScreen({
  stores,
  orders,
  customer,
  sessionNotice,
  onSelectStore,
  onLoginRequest,
  onLogout,
}: StoreSelectorScreenProps) {
  const [activeTab, setActiveTab] = useState<'restaurants' | 'markets' | 'orders'>('restaurants')
  const [storeList, setStoreList] = useState<StoreSummary[]>([])
  const [loadingStores, setLoadingStores] = useState(true)
  const [storesError, setStoresError] = useState<string | null>(null)

  const [ordersList, setOrdersList] = useState<OrderSummary[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [ordersError, setOrdersError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [userCoords, setUserCoords] = useState<Coordinates | null>(null)
  const [locationActive, setLocationActive] = useState(false)
  const [dismissedNotice, setDismissedNotice] = useState(false)

  // Geolocation detection
  const requestLocation = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          })
          setLocationActive(true)
        },
        () => {
          // Fallback to campus center if user denies permission
          setUserCoords(EACH_USP_COORDINATES)
          setLocationActive(false)
        },
        { timeout: 8000 },
      )
    } else {
      setUserCoords(EACH_USP_COORDINATES)
    }
  }, [])

  useEffect(() => {
    requestLocation()
  }, [requestLocation])

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

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoadingOrders(true)
    setOrdersError(null)
    try {
      const items = await orders.listCustomerOrders()
      setOrdersList(items)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível carregar o histórico de pedidos.'
      setOrdersError(message)
    } finally {
      if (!silent) setLoadingOrders(false)
    }
  }, [orders])

  useEffect(() => {
    void loadStores()
  }, [loadStores])

  useEffect(() => {
    if (!customer && activeTab === 'orders') {
      setActiveTab('restaurants')
    }
  }, [customer, activeTab])

  useEffect(() => {
    if (activeTab !== 'orders' || !customer) return
    void loadOrders(false)
    const timer = setInterval(() => {
      void loadOrders(true)
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [activeTab, customer, loadOrders])

  // Filtered and proximity-sorted stores
  const enrichedStores = useMemo(() => {
    const coordsRef = userCoords ?? EACH_USP_COORDINATES
    const withDistance = storeList.map((store) => {
      const tag = store.category ?? (store.segment === 'market' ? 'Mercado Express' : 'Restaurante')
      const description =
        store.segment === 'market'
          ? 'Produtos de conveniência, snacks e bebidas prontos para retirada express em até 5 min.'
          : 'Cardápio completo com opções preparadas na hora e entrega expressa no campus.'
      const storeCoords: Coordinates = {
        latitude: store.latitude ?? EACH_USP_COORDINATES.latitude,
        longitude: store.longitude ?? EACH_USP_COORDINATES.longitude,
      }
      const distanceMeters = calculateDistanceMeters(coordsRef, storeCoords)
      return {
        ...store,
        tag,
        description,
        distanceMeters,
        address: store.address ?? 'Praça de Alimentação',
      }
    })

    let filtered = withDistance
    if (activeTab === 'restaurants') {
      filtered = filtered.filter((s) => s.segment !== 'market')
    } else if (activeTab === 'markets') {
      filtered = filtered.filter((s) => s.segment === 'market')
    }

    if (selectedCategory === 'Mais Próximos') {
      filtered = [...filtered].sort((a, b) => a.distanceMeters - b.distanceMeters)
    } else if (selectedCategory !== 'Todos') {
      const searchCat = selectedCategory.toLowerCase()
      filtered = filtered.filter((s) => {
        const pool = `${s.name} ${s.tag} ${s.category ?? ''}`.toLowerCase()
        if (searchCat === 'burgers') {
          return pool.includes('burger') || pool.includes('hamburguer')
        }
        if (searchCat === 'italiano') {
          return pool.includes('italian')
        }
        return pool.includes(searchCat)
      })
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.tag.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q),
      )
    }

    return filtered
  }, [storeList, userCoords, activeTab, selectedCategory, searchQuery])

  const categoryChips =
    activeTab === 'markets' ? CATEGORY_CHIPS_MARKETS : CATEGORY_CHIPS_RESTAURANTS

  const closestSlug = useMemo(() => {
    if (enrichedStores.length === 0) return null
    const sorted = [...enrichedStores].sort((a, b) => a.distanceMeters - b.distanceMeters)
    return sorted[0]?.slug
  }, [enrichedStores])

  return (
    <div className="flex min-h-dvh flex-col bg-cream text-ink">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-surface/90 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <StoreMark size={36} />
          <div>
            <p className="text-[14px] font-bold tracking-tight">TOPA</p>
            <p className="text-[11px] text-muted">
              {customer ? `Olá, ${customer.name}` : 'Praça de Alimentação'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {customer && onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sair da conta"
              className="flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-line px-3 py-1.5 text-[13px] font-semibold text-muted transition hover:border-ink hover:text-ink motion-safe:active:scale-95"
            >
              <LogoutIcon size={16} />
              <span>Sair</span>
            </button>
          ) : (
            onLoginRequest && (
              <button
                type="button"
                onClick={onLoginRequest}
                className="cursor-pointer rounded-[10px] bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-ink/90 motion-safe:active:scale-95"
              >
                Entrar / Cadastrar
              </button>
            )
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col p-6">
        {sessionNotice && !dismissedNotice && (
          <aside
            role="status"
            className="mb-6 flex items-start justify-between gap-3 rounded-[16px] border border-warning/30 bg-warning-tint p-4 text-warning shadow-sm motion-safe:animate-slide-up"
          >
            <div className="flex items-start gap-3">
              <AlertIcon size={20} className="mt-0.5 flex-none" />
              <div>
                <p className="text-[14px] font-bold">Aviso do Totem</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-warning/90">{sessionNotice}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissedNotice(true)}
              aria-label="Fechar aviso"
              className="cursor-pointer p-1 text-warning/70 hover:text-warning"
            >
              <CloseIcon size={16} />
            </button>
          </aside>
        )}

        <div className="mb-4">
          <h1 className="text-[26px] font-bold tracking-tight">
            {activeTab === 'markets'
              ? 'TOPA Mercados: Conveniência & Express'
              : activeTab === 'orders'
                ? 'Meus Pedidos'
                : 'Onde você quer pedir hoje?'}
          </h1>
          <p className="mt-1 text-[15px] text-muted">
            {activeTab === 'markets'
              ? 'Bebidas geladas, snacks rápidos, laticínios e conveniência do campus prontos para retirada rápida.'
              : activeTab === 'orders'
                ? 'Acompanhe o status e histórico dos seus pedidos em todos os restaurantes.'
                : 'Escolha um restaurante da praça para abrir o cardápio e fazer seu pedido pelo celular.'}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Navegação do cliente"
          className="mb-6 flex flex-wrap gap-2 border-b border-line pb-3"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'restaurants'}
            onClick={() => {
              setActiveTab('restaurants')
              setSelectedCategory('Todos')
              setSearchQuery('')
            }}
            className={`flex items-center gap-2 cursor-pointer rounded-[12px] px-4 py-2 text-[14px] font-semibold transition-all duration-150 motion-safe:active:scale-95 ${
              activeTab === 'restaurants' ? 'bg-ink text-white shadow-sm' : 'bg-ground-2 text-muted hover:text-ink'
            }`}
          >
            <StoreMark size={16} />
            <span>Restaurantes</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'markets'}
            onClick={() => {
              setActiveTab('markets')
              setSelectedCategory('Todos')
              setSearchQuery('')
            }}
            className={`flex items-center gap-2 cursor-pointer rounded-[12px] px-4 py-2 text-[14px] font-semibold transition-all duration-150 motion-safe:active:scale-95 ${
              activeTab === 'markets' ? 'bg-ink text-white shadow-sm' : 'bg-ground-2 text-muted hover:text-ink'
            }`}
          >
            <MarketIcon size={16} />
            <span>TOPA Mercados</span>
          </button>
          {customer && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'orders'}
              onClick={() => {
                setActiveTab('orders')
                setSearchQuery('')
              }}
              className={`cursor-pointer rounded-[12px] px-4 py-2 text-[14px] font-semibold transition-all duration-150 motion-safe:active:scale-95 ${
                activeTab === 'orders' ? 'bg-ink text-white shadow-sm' : 'bg-ground-2 text-muted hover:text-ink'
              }`}
            >
              Meus Pedidos
            </button>
          )}
        </div>

        {!customer && onLoginRequest && (
          <aside className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-[18px] border border-line bg-surface p-4 shadow-xs motion-safe:animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ground-2 shadow-inner">
                <GoogleIcon size={22} />
              </div>
              <div>
                <p className="text-[14px] font-bold text-ink">Entrar com sua conta Google</p>
                <p className="text-[12px] text-muted">Acesse em 1 clique para salvar seu histórico e pedir mais rápido.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onLoginRequest}
              className="flex cursor-pointer items-center gap-2 rounded-[10px] bg-ink px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-ink/90 motion-safe:active:scale-95"
            >
              <GoogleIcon size={16} />
              <span>Login com Google</span>
            </button>
          </aside>
        )}

        {activeTab === 'markets' && (
          <div className="mb-6 flex items-center justify-between rounded-[16px] border border-teal/20 bg-teal/5 p-4 text-teal shadow-xs motion-safe:animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal text-white shadow-xs">
                <MarketIcon size={20} />
              </div>
              <div>
                <p className="text-[14px] font-bold text-teal">TOPA Mercados: Retirada Express</p>
                <p className="text-[12px] text-teal/80">Snacks, bebidas geladas e produtos essenciais do campus sem filas.</p>
              </div>
            </div>
            <span className="rounded-full bg-teal/10 px-3 py-1 text-[11px] font-bold text-teal">
              ⚡ 5 min
            </span>
          </div>
        )}

        {activeTab !== 'orders' && (
          <>
            {/* Location & Proximity Bar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-line bg-surface p-3.5 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3 items-center justify-center">
                  {locationActive && (
                    <span className="absolute inline-flex h-full w-full rounded-full bg-teal opacity-75 motion-safe:animate-ping" />
                  )}
                  <span
                    className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                      locationActive ? 'bg-teal' : 'bg-muted/60'
                    }`}
                  />
                </span>
                <span className="text-[13px] font-medium text-ink">
                  {locationActive
                    ? 'Localização ativa: ordenando restaurantes perto de você'
                    : 'Praça de Alimentação EACH-USP (distâncias estimadas)'}
                </span>
              </div>

              {!locationActive && (
                <button
                  type="button"
                  onClick={requestLocation}
                  className="flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-line bg-ground-2 px-3 py-1 text-[12px] font-semibold text-ink transition hover:border-ink motion-safe:active:scale-95"
                >
                  <PinIcon size={14} />
                  <span>Usar minha localização</span>
                </button>
              )}
            </div>

            {/* Search and Category Filters */}
            <div className="mb-6 space-y-3">
              <div className="relative">
                <SearchIcon
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === 'markets'
                      ? 'Buscar no mercado por bebidas, snacks, chocolates...'
                      : 'Buscar por nome do restaurante ou tipo de comida...'
                  }
                  className="h-11 w-full rounded-[14px] border border-line bg-white pl-10 pr-10 text-[14px] text-ink shadow-xs outline-none transition focus:border-ink focus:ring-1 focus:ring-ink"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Limpar busca"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer text-muted hover:text-ink"
                  >
                    <CloseIcon size={16} />
                  </button>
                )}
              </div>

              <div
                role="group"
                aria-label="Filtrar categorias"
                className="flex flex-wrap gap-2 pt-1"
              >
                {categoryChips.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`cursor-pointer rounded-full px-3.5 py-1 text-[12px] font-semibold transition-all duration-150 motion-safe:active:scale-95 ${
                      selectedCategory === cat
                        ? 'bg-ink text-white shadow-xs'
                        : 'border border-line bg-white text-muted hover:border-ink/50 hover:text-ink'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {loadingStores && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-48 rounded-[20px] border border-line bg-white p-6 shadow-xs motion-safe:animate-pulse"
                  >
                    <div className="h-4 w-24 rounded bg-ground-2" />
                    <div className="mt-4 h-6 w-48 rounded bg-ground-2" />
                    <div className="mt-2 h-4 w-full rounded bg-ground-2" />
                    <div className="mt-6 h-10 w-full rounded bg-ground-2" />
                  </div>
                ))}
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
                  className="cursor-pointer rounded-[10px] bg-ink px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-ink/90 motion-safe:active:scale-95"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!loadingStores && !storesError && enrichedStores.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] border border-line bg-surface py-16 px-6 text-center shadow-xs">
                <p className="text-[17px] font-bold text-ink">
                  {activeTab === 'markets'
                    ? 'Nenhum mercado encontrado'
                    : 'Nenhum restaurante encontrado'}
                </p>
                <p className="max-w-[36ch] text-[14px] text-muted">
                  {activeTab === 'markets'
                    ? 'Tente ajustar a busca para encontrar produtos de conveniência.'
                    : 'Tente ajustar a busca ou escolher outra categoria para encontrar seu pedido.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedCategory('Todos')
                  }}
                  className="mt-2 cursor-pointer rounded-[10px] border border-line bg-white px-4 py-2 text-[13px] font-semibold text-ink transition hover:border-ink"
                >
                  Limpar filtros
                </button>
              </div>
            )}

            {!loadingStores && !storesError && enrichedStores.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {enrichedStores.map((store, idx) => {
                  const isClosest = store.slug === closestSlug
                  return (
                    <article
                      key={store.slug}
                      style={{ animationDelay: `${idx * 60}ms` }}
                      className="group flex flex-col justify-between rounded-[20px] border border-line bg-white p-6 shadow-xs transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-teal/30 hover:shadow-md motion-safe:animate-slide-up motion-safe:active:scale-[0.99]"
                    >
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="rounded-full bg-cream px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                            {store.tag}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {isClosest && (
                              <span className="flex items-center gap-1 rounded-full bg-sage-tint px-2 py-0.5 text-[11px] font-bold text-teal">
                                <span className="h-1.5 w-1.5 rounded-full bg-teal motion-safe:animate-pulse" />
                                Mais perto
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-[12px] font-medium text-teal">
                              <span className="h-2 w-2 rounded-full bg-teal" />
                              Aberto
                            </span>
                          </div>
                        </div>

                        <h2 className="text-[20px] font-bold tracking-tight text-ink transition group-hover:text-teal">
                          {store.name}
                        </h2>

                        <div className="mt-1 flex items-center gap-1 text-[12px] font-medium text-muted">
                          <PinIcon size={14} className="text-teal/80" />
                          <span>
                            a {formatDistance(store.distanceMeters)} ({formatWalkingTime(store.distanceMeters)})
                          </span>
                          <span className="text-line">•</span>
                          <span>{store.address}</span>
                        </div>

                        <p className="mt-3 text-[14px] leading-relaxed text-muted">
                          {store.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectStore(store.slug)}
                        className="mt-6 flex h-11 w-full cursor-pointer items-center justify-center rounded-[12px] bg-ink text-[14px] font-semibold text-white shadow-xs transition-[transform,background-color] duration-150 hover:bg-teal group-hover:bg-teal motion-safe:active:scale-[0.98]"
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
                  className="cursor-pointer rounded-[10px] bg-ink px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-ink/90 motion-safe:active:scale-95"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!loadingOrders && !ordersError && ordersList.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] border border-line bg-surface py-16 px-6 text-center shadow-xs">
                <p className="text-[18px] font-bold text-ink">Nenhum pedido realizado</p>
                <p className="max-w-[36ch] text-[14px] text-muted">
                  Você ainda não fez nenhum pedido. Escolha um dos restaurantes da praça para começar.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('restaurants')}
                  className="cursor-pointer rounded-[12px] bg-ink px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-ink/90 motion-safe:active:scale-95"
                >
                  Ver restaurantes
                </button>
              </div>
            )}

            {!loadingOrders && !ordersError && ordersList.length > 0 && (
              <div className="space-y-3">
                {ordersList.map((order, idx) => {
                  const badge = statusBadge(order.status)
                  return (
                    <article
                      key={order.id}
                      style={{ animationDelay: `${idx * 50}ms` }}
                      className="flex flex-col justify-between gap-4 rounded-[18px] border border-line bg-white p-5 shadow-xs transition-[transform,box-shadow] duration-150 hover:shadow-md motion-safe:animate-slide-up sm:flex-row sm:items-center"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[18px] font-bold text-ink">
                            Pedido #{displayNumber(order.number)}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${badge.badgeClass}`}
                          >
                            <span className={`h-2 w-2 rounded-full ${badge.dotClass}`} />
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-[13px] text-muted">
                          <span>{order.storeSlug ?? 'Restaurante'}</span> • {formatOrderDate(order.createdAt)}
                        </p>
                        <p className="text-[14px] text-ink/80">
                          {order.items.map((i) => i.name).join(', ')}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-line pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                        <span className="text-[12px] text-muted sm:text-right">Total pago</span>
                        <span className="text-[18px] font-bold text-ink">
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
