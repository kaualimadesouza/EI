import { useCallback, useEffect, useState } from 'react'

import { metricsOf } from '../../domain/metrics'
import type { Product } from '../../domain/menu'
import { ageMinutes, displayNumber, type OrderSummary } from '../../domain/order'
import { nextStatus } from '../../domain/status'
import { DEMO_STORE_NAME, DEMO_STORE_SLUG } from '../../domain/store'
import type { Adapters } from '../../ports/adapters'
import { OrderRejectedError } from '../../ports/orders'
import { AlertIcon, BoardIcon, ChartIcon, ExternalIcon, ListIcon, StoreMark, UndoIcon } from '../icons'
import { HourlyChart } from './HourlyChart'
import { KpiRow } from './KpiRow'
import { MenuTable } from './MenuTable'
import { OrdersBoard } from './OrdersBoard'

interface PainelAppProps {
  adapters: Adapters
  storeSlug?: string
  now?: () => Date
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

export function PainelApp({ adapters, storeSlug = DEMO_STORE_SLUG, now = () => new Date() }: PainelAppProps) {
  const [storeName, setStoreName] = useState(DEMO_STORE_NAME)
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [yesterday, setYesterday] = useState<OrderSummary[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [offline, setOffline] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [undo, setUndo] = useState<Undo | null>(null)
  const [locked, setLocked] = useState(false)

  const today = now()
  const todayKey = businessDate(today)

  const refresh = useCallback(() => {
    adapters.orders.list(todayKey, storeSlug).then(
      (list) => {
        setOrders(list)
        setOffline(false)
      },
      () => setOffline(true),
    )
  }, [adapters.orders, storeSlug, todayKey])

  // polling keeps a kiosk tab and this one in step, through the API or the shared browser storage
  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  useEffect(() => {
    const yesterdayKey = businessDate(dayBefore(new Date(`${todayKey}T12:00:00`)))
    adapters.orders.list(yesterdayKey, storeSlug).then(setYesterday, () => setYesterday([]))
  }, [adapters.orders, storeSlug, todayKey])

  useEffect(() => {
    adapters.menu.load(storeSlug).then(
      (menu) => {
        setStoreName(menu.store.name)
        setProducts(menu.products)
      },
      () => setOffline(true),
    )
  }, [adapters.menu, storeSlug])

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

  const metrics = metricsOf(orders)
  const late = orders.filter((order) => order.status !== 'delivered' && ageMinutes(order, today) >= 10)
  const soldOut = products.filter((product) => !product.available)
  const alerts: string[] = []
  if (offline) alerts.push('O servidor não responde. Os números abaixo podem estar desatualizados.')
  if (late.length === 1) alerts.push(`O pedido ${displayNumber(late[0].number)} espera há ${ageMinutes(late[0], today)} min.`)
  if (late.length > 1) alerts.push(`${late.length} pedidos esperam há mais de 10 min.`)
  if (soldOut.length > 0) alerts.push(`Esgotados no totem: ${soldOut.map((p) => p.name).join(', ')}.`)

  return (
    <div className="flex min-h-dvh bg-cream text-ink">
      <aside className="sticky top-0 flex h-dvh w-60 flex-none flex-col gap-8 border-r border-line bg-ground-2 px-4 py-6 max-xl:w-[76px] max-xl:px-3 max-md:hidden">
        <div className="flex items-center gap-3 px-2 max-xl:justify-center max-xl:px-0">
          <StoreMark size={40} />
          <span className="flex flex-col max-xl:hidden">
            <span className="text-[16px] font-semibold">{storeName}</span>
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
        <a
          href={import.meta.env.BASE_URL}
          aria-label="Abrir o totem"
          className="mt-auto flex h-12 items-center gap-3 rounded-[12px] px-3 text-[15px] font-medium text-teal hover:bg-white max-xl:justify-center"
        >
          <ExternalIcon size={20} />
          <span className="max-xl:hidden">Abrir o totem</span>
        </a>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-8 px-8 py-6 max-md:px-4">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-[32px] leading-tight font-bold">Painel do lojista</h1>
            <p className="text-[15px] text-muted first-letter:uppercase">{longDate.format(today)}</p>
          </div>
          <p className="text-[14px] text-muted">
            {adapters.mode === 'demo' ? 'Modo demonstração: dados deste navegador' : 'Dados do servidor'}, atualizados a cada 3 s
          </p>
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
          <div>
            <h2 id="cardapio-title" className="text-[22px] font-bold">Cardápio</h2>
            <p className="text-[15px] text-muted">Um item esgotado aparece como esgotado no totem a partir do próximo cliente.</p>
          </div>
          <MenuTable products={products} orders={orders} onAvailability={(product, available) => void setAvailability(product, available)} />
        </section>
      </main>
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
