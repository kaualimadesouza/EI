import { formatBRL } from '../../domain/menu'
import { ageMinutes, displayNumber, type OrderSummary } from '../../domain/order'
import { ClockIcon } from '../icons'

interface OrdersBoardProps {
  orders: readonly OrderSummary[]
  now: Date
  locked: boolean
  onAdvance: (order: OrderSummary) => void
}

interface Column {
  status: 'received' | 'preparing' | 'ready'
  title: string
  action: string
}

const COLUMNS: readonly Column[] = [
  { status: 'received', title: 'Recebidos', action: 'Começar preparo' },
  { status: 'preparing', title: 'Em preparo', action: 'Marcar como pronto' },
  { status: 'ready', title: 'Prontos', action: 'Entregar' },
]

const SLOW_MINUTES = 5
const LATE_MINUTES = 10

const clock = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function OrdersBoard({ orders, now, locked, onAdvance }: OrdersBoardProps) {
  const delivered = orders.filter((order) => order.status === 'delivered')

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(3,minmax(240px,1fr))] gap-4 overflow-x-auto pb-1">
        {COLUMNS.map((column) => {
          const inColumn = orders.filter((order) => order.status === column.status)
          return (
            <section key={column.status} aria-label={column.title} className="flex flex-col gap-3 rounded-[20px] bg-ground-2 p-3">
              <h3 className="flex items-center justify-between px-2 pt-1 text-[16px] font-semibold">
                {column.title}
                <span className="rounded-full bg-white px-2.5 text-[14px] tabular-nums">{inColumn.length}</span>
              </h3>
              {inColumn.length === 0 && <p className="px-2 pb-2 text-[14px] text-muted">Nenhum pedido aqui.</p>}
              {inColumn.map((order) => (
                <OrderCard key={order.id} order={order} now={now} action={column.action} locked={locked} onAdvance={onAdvance} />
              ))}
            </section>
          )
        })}
      </div>
      <details className="rounded-[20px] border border-line bg-white">
        <summary className="cursor-pointer px-5 py-4 text-[16px] font-semibold">Entregues hoje ({delivered.length})</summary>
        {delivered.length === 0 ? (
          <p className="px-5 pb-4 text-[14px] text-muted">Nenhum pedido entregue ainda.</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {delivered.map((order) => (
              <li key={order.id} className="flex items-center gap-4 px-5 py-3 text-[15px]">
                <span className="w-14 font-semibold tabular-nums">{displayNumber(order.number)}</span>
                <span className="w-14 text-muted tabular-nums">{clock.format(new Date(order.createdAt))}</span>
                <span className="min-w-0 flex-1 truncate">{order.items.map((item) => `${item.quantity}× ${item.name}`).join(', ')}</span>
                <span className="font-semibold tabular-nums">{formatBRL(order.totalCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  )
}

interface OrderCardProps {
  order: OrderSummary
  now: Date
  action: string
  locked: boolean
  onAdvance: (order: OrderSummary) => void
}

function OrderCard({ order, now, action, locked, onAdvance }: OrderCardProps) {
  const age = ageMinutes(order, now)
  const late = age >= LATE_MINUTES
  const number = displayNumber(order.number)

  return (
    <article
      aria-label={`Pedido ${number}`}
      className={`flex flex-col gap-3 rounded-[16px] border p-4 ${late ? 'border-warning bg-warning-tint' : 'border-line bg-white'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[28px] leading-none font-bold tabular-nums">{number}</span>
        <span className={`flex items-center gap-1 text-[14px] font-medium ${age >= SLOW_MINUTES ? 'text-warning' : 'text-muted'}`}>
          <ClockIcon size={16} />
          {age === 0 ? 'agora' : `há ${age} min`}
        </span>
      </div>
      {order.dineIn ? (
        <span className="text-[14px] text-muted">Comer aqui</span>
      ) : (
        <span className="self-start rounded-full bg-ink px-2.5 py-0.5 text-[13px] font-semibold text-white">Para viagem</span>
      )}
      <ul className="flex flex-col gap-1 text-[15px]">
        {order.items.map((item) => (
          <li key={item.productId} className="flex gap-2">
            <span className="w-7 flex-none font-bold tabular-nums">{item.quantity}×</span>
            <span>{item.name}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onAdvance(order)}
        disabled={locked}
        className="h-12 rounded-[12px] bg-teal px-4 text-[15px] font-semibold text-white disabled:opacity-50"
      >
        {action}
      </button>
    </article>
  )
}
