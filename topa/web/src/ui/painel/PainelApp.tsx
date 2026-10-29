import { useCallback, useEffect, useState } from 'react'

import { metricsOf } from '../../domain/metrics'
import type { Product } from '../../domain/menu'
import { ageMinutes, displayNumber, type OrderSummary } from '../../domain/order'
import { nextStatus } from '../../domain/status'
import { DEMO_STORE_SLUG } from '../../domain/store'
import type { Adapters } from '../../ports/adapters'
import type { AuthenticatedMerchant } from '../../ports/auth'
import { type CreateProductDraft, StoreNotFoundError, type UpdateProductDraft } from '../../ports/menu'
import { OrderRejectedError } from '../../ports/orders'
import { AlertIcon, BoardIcon, ChartIcon, ExternalIcon, ListIcon, LogoutIcon, PlusIcon, StoreMark, UndoIcon } from '../icons'
import { HourlyChart } from './HourlyChart'
import { KpiRow } from './KpiRow'
import { LoginScreen } from './LoginScreen'
import { MenuTable } from './MenuTable'
import { OrdersBoard } from './OrdersBoard'
import { ProductModal } from './ProductModal'

interface PainelAppProps {
  adapters: Adapters
  storeSlug?: string
  now?: () => Date
  onSwitchToTotem?: () => void
}

interface Undo {
  orderId: string
  number: number
  status: OrderSummary['status']
  previous: OrderSummary['status']
}

export const POLL_MS = 3000
export const UNDO_MS = 8000
// a second tap on the same card while the list catches up must not move the order twice
const GUARD_MS = 400

const MOVED_TO: Record<OrderSummary['status'], string> = {
  received: 'voltou para recebidos',
  preparing: 'foi para o preparo',
  ready: 'está pronto',
  delivered: 'foi entregue',
}

const longDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

function businessDate(date: Date): string {
  return date.toLocaleDateString('sv-SE')
}

function dayBefore(date: Date): Date {
  const previous = new Date(date)
  previous.setDate(previous.getDate() - 1)
  return previous
}

export function PainelApp({ adapters, storeSlug = DEMO_STORE_SLUG, now = () => new Date(), onSwitchToTotem }: PainelAppProps) {
  const [merchant, setMerchant] = useState<AuthenticatedMerchant | null>(() => adapters.auth.getMerchant())
  const [storeName, setStoreName] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [yesterday, setYesterday] = useState<OrderSummary[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [offline, setOffline] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [undo, setUndo] = useState<Undo | null>(null)
  const [locked, setLocked] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | 'new' | null>(null)

  const today = now()
  const todayKey = businessDate(today)

  const handleLogout = useCallback(async () => {
    await adapters.auth.logout()
    setMerchant(null)
  }, [adapters.auth])

  const refresh = useCallback(() => {
    adapters.orders.list(todayKey, storeSlug).then(
      (list) => {
        setOrders(list)
        setOffline(false)
      },
      (error: unknown) => {
        if (error instanceof StoreNotFoundError) {
          setNotFound(true)
        } else {
          setOffline(true)
        }
      },
    )
  }, [adapters.orders, storeSlug, todayKey])

  // polling keeps a kiosk tab and this one in step, through the API or the shared browser storage
  useEffect(() => {
    if (!merchant || merchant.storeSlug !== storeSlug || notFound) return
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [merchant, notFound, refresh, storeSlug])

  useEffect(() => {
    if (!merchant || merchant.storeSlug !== storeSlug) return
    const yesterdayKey = businessDate(dayBefore(new Date(`${todayKey}T12:00:00`)))
    adapters.orders.list(yesterdayKey, storeSlug).then(setYesterday, () => setYesterday([]))
  }, [adapters.orders, merchant, storeSlug, todayKey])

  useEffect(() => {
    if (!merchant || merchant.storeSlug !== storeSlug) return
    adapters.menu.load(storeSlug).then(
      (menu) => {
        setStoreName(menu.store.name)
        setProducts(menu.products)
      },
      (error: unknown) => {
        if (error instanceof StoreNotFoundError) {
          setNotFound(true)
        } else {
          setOffline(true)
        }
      },
    )
  }, [adapters.menu, merchant, storeSlug])

  useEffect(() => {
    if (!undo) return
    const timer = setTimeout(() => setUndo(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [undo])

  const move = async (orderId: string, status: OrderSummary['status']): Promise<OrderSummary | null> => {
    try {
      const moved = await adapters.orders.setStatus(orderId, status)
      setOrders((list) => list.map((order) => (order.id === moved.id ? moved : order)))
      setProblem(null)
      return moved
    } catch (error) {
      setProblem(error instanceof OrderRejectedError ? error.message : 'Não foi possível mudar o pedido. Tente de novo.')
      return null
    }
  }

  const advance = async (order: OrderSummary) => {
    const status = nextStatus(order.status)!
    setLocked(true)
    setTimeout(() => setLocked(false), GUARD_MS)
    const moved = await move(order.id, status)
    if (moved) setUndo({ orderId: order.id, number: order.number, status, previous: order.status })
  }

  const revert = async (step: Undo) => {
    setUndo(null)
    await move(step.orderId, step.previous)
  }

  const setAvailability = async (product: Product, available: boolean) => {
    try {
      const updated = await adapters.menu.setAvailability(product.id, available, storeSlug)
      setProducts((list) => list.map((p) => (p.id === updated.id ? updated : p)))
      setProblem(null)
    } catch {
      setProblem(`Não foi possível mudar ${product.name}. Tente de novo.`)
    }
  }

  const handleSaveProduct = async (draft: CreateProductDraft | UpdateProductDraft) => {
    try {
      if (editingProduct === 'new') {
        const created = await adapters.menu.create(draft as CreateProductDraft, storeSlug)
        setProducts((list) => [...list, created])
      } else {
        const target = editingProduct!
        const updated = await adapters.menu.update(target.id, draft as UpdateProductDraft, storeSlug)
        setProducts((list) => list.map((p) => (p.id === updated.id ? updated : p)))
      }
      setProblem(null)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Não foi possível salvar o produto. Tente de novo.'
      setProblem(msg)
      throw error
    }
  }

  const metrics = metricsOf(orders)
  const late = orders.filter((order) => order.status !== 'delivered' && ageMinutes(order, today) >= 10)
  const soldOut = products.filter((product) => !product.available)
  const alerts: string[] = []
  if (offline) alerts.push('O servidor não responde. Os números abaixo podem estar desatualizados.')
  if (late.length === 1) alerts.push(`O pedido ${displayNumber(late[0].number)} espera há ${ageMinutes(late[0], today)} min.`)
  if (late.length > 1) alerts.push(`${late.length} pedidos esperam há mais de 10 min.`)
  if (soldOut.length > 0) alerts.push(`Esgotados no totem: ${soldOut.map((p) => p.name).join(', ')}.`)

  if (!merchant) {
    return <LoginScreen auth={adapters.auth} storeSlug={storeSlug} onLoginSuccess={setMerchant} />
  }

  if (merchant.storeSlug !== storeSlug) {
    return (
      <section
        role="alert"
        className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cream px-8 text-center text-ink"
      >
        <h1 className="text-title font-bold">Acesso não autorizado</h1>
        <p className="max-w-[42ch] text-body text-muted">
          Seu usuário pertence à loja {merchant.storeSlug}. Você não tem permissão para gerenciar a loja {storeSlug}.
        </p>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="mt-2 flex h-11 items-center gap-2 rounded-[12px] bg-ink px-5 text-[15px] font-semibold text-white"
        >
          <LogoutIcon size={18} />
          <span>Sair</span>
        </button>
      </section>
    )
  }

  if (notFound) {
    return (
      <section role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cream px-8 text-center text-ink">
        <h1 className="text-title font-bold">Loja não encontrada</h1>
        <p className="max-w-[36ch] text-body text-muted">
          Confira o identificador da loja no endereço do painel.
        </p>
      </section>
    )
  }

  return (
    <div className="flex min-h-dvh bg-cream text-ink">
      <aside className="sticky top-0 flex h-dvh w-60 flex-none flex-col gap-8 border-r border-line bg-ground-2 px-4 py-6 max-xl:w-[76px] max-xl:px-3 max-md:hidden">
        <div className="flex items-center gap-3 px-2 max-xl:justify-center max-xl:px-0">
          <StoreMark size={40} />
          <span className="flex flex-col max-xl:hidden">
            <span className="text-[16px] font-semibold">{storeName ?? 'TOPA'}</span>
            <span className="text-[13px] text-muted">Painel do lojista</span>
          </span>
        </div>
        <nav aria-label="Seções do painel" className="flex flex-col gap-1">
          {[
            { href: '#pedidos', label: 'Pedidos', icon: <BoardIcon size={22} /> },
            { href: '#resumo', label: 'Resumo do dia', icon: <ChartIcon size={22} /> },
            { href: '#cardapio', label: 'Cardápio', icon: <ListIcon size={22} /> },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-label={link.label}
              className="flex h-12 items-center gap-3 rounded-[12px] px-3 text-[15px] font-medium hover:bg-white max-xl:justify-center"
            >
              {link.icon}
              <span className="max-xl:hidden">{link.label}</span>
            </a>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          {onSwitchToTotem ? (
            <button
              type="button"
              onClick={onSwitchToTotem}
              aria-label="Abrir o totem"
              className="flex h-12 cursor-pointer items-center gap-3 rounded-[12px] px-3 text-[15px] font-medium text-teal hover:bg-white max-xl:justify-center"
            >
              <ExternalIcon size={20} />
              <span className="max-xl:hidden">Abrir o totem</span>
            </button>
          ) : (
            <a
              href={import.meta.env.BASE_URL}
              aria-label="Abrir o totem"
              className="flex h-12 items-center gap-3 rounded-[12px] px-3 text-[15px] font-medium text-teal hover:bg-white max-xl:justify-center"
            >
              <ExternalIcon size={20} />
              <span className="max-xl:hidden">Abrir o totem</span>
            </a>
          )}
          <button
            type="button"
            onClick={() => void handleLogout()}
            aria-label="Sair"
            className="flex h-12 cursor-pointer items-center gap-3 rounded-[12px] px-3 text-[15px] font-medium text-muted hover:bg-white hover:text-ink max-xl:justify-center"
          >
            <LogoutIcon size={20} />
            <span className="max-xl:hidden">Sair</span>
          </button>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-8 px-8 py-6 max-md:px-4">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-[32px] leading-tight font-bold">Painel do lojista</h1>
            <p className="text-[15px] text-muted first-letter:uppercase">{longDate.format(today)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {onSwitchToTotem && (
              <button
                type="button"
                onClick={onSwitchToTotem}
                aria-label="Abrir o totem"
                className="hidden cursor-pointer items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-1.5 text-[14px] font-medium text-teal hover:bg-ground-2 max-md:inline-flex"
              >
                <ExternalIcon size={18} />
                <span>Abrir o totem</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label="Sair"
              className="hidden cursor-pointer items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-1.5 text-[14px] font-medium text-muted hover:bg-ground-2 hover:text-ink max-md:inline-flex"
            >
              <LogoutIcon size={18} />
              <span>Sair</span>
            </button>
            <p className="text-[14px] text-muted">
              {adapters.mode === 'demo' ? 'Modo demonstração: dados deste navegador' : 'Dados do servidor'}, atualizados a cada 3 s
            </p>
          </div>
        </header>
        {(alerts.length > 0 || problem) && (
          <div role="alert" className="flex items-start gap-3 rounded-[16px] bg-warning-tint px-5 py-3 text-[15px] font-medium text-warning">
            <AlertIcon size={20} className="mt-0.5" />
            <ul className="flex flex-col gap-1">
              {problem && <li>{problem}</li>}
              {alerts.map((alert) => (
                <li key={alert}>{alert}</li>
              ))}
            </ul>
          </div>
        )}
        <section id="resumo" aria-labelledby="resumo-title" className="flex scroll-mt-6 flex-col gap-4">
          <h2 id="resumo-title" className="sr-only">Resumo do dia</h2>
          <KpiRow today={metrics} yesterday={metricsOf(yesterday)} />
        </section>
        <section id="pedidos" aria-labelledby="pedidos-title" className="flex scroll-mt-6 flex-col gap-4">
          <h2 id="pedidos-title" className="text-[22px] font-bold">Pedidos em andamento</h2>
          <OrdersBoard orders={orders} now={today} locked={locked} onAdvance={(order) => void advance(order)} />
        </section>
        <HourlyChart byHour={metrics.byHour} currentHour={today.getHours()} />
        <section id="cardapio" aria-labelledby="cardapio-title" className="flex scroll-mt-6 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 id="cardapio-title" className="text-[22px] font-bold">Cardápio</h2>
              <p className="text-[15px] text-muted">Um item esgotado aparece como esgotado no totem a partir do próximo cliente.</p>
            </div>
            <button
              type="button"
              onClick={() => setEditingProduct('new')}
              aria-label="Novo produto"
              className="flex h-11 cursor-pointer items-center gap-2 rounded-[12px] bg-teal px-4 text-[15px] font-semibold text-white hover:bg-slate"
            >
              <PlusIcon size={18} />
              <span>Novo produto</span>
            </button>
          </div>
          <MenuTable
            products={products}
            orders={orders}
            onAvailability={(product, available) => void setAvailability(product, available)}
            onEdit={(product) => setEditingProduct(product)}
          />
        </section>
      </main>
      <ProductModal
        product={editingProduct === 'new' ? null : editingProduct}
        isOpen={editingProduct !== null}
        onClose={() => setEditingProduct(null)}
        onSave={handleSaveProduct}
      />
      {undo && (
        <div role="status" className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-4 rounded-[16px] bg-ink py-3 pr-3 pl-5 text-[15px] text-white shadow-lg">
          Pedido {displayNumber(undo.number)} {MOVED_TO[undo.status]}.
          <button
            type="button"
            onClick={() => void revert(undo)}
            className="flex h-10 items-center gap-2 rounded-[10px] bg-white px-3 font-semibold text-ink"
          >
            <UndoIcon size={18} />
            Desfazer
          </button>
        </div>
      )}
    </div>
  )
}
