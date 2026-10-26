import { changeRatio, type DayMetrics } from '../../domain/metrics'
import { formatBRL } from '../../domain/menu'

interface KpiRowProps {
  today: DayMetrics
  yesterday: DayMetrics
}

interface Tile {
  label: string
  value: string
  delta: string
  look: string
}

const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 })

// up is good for money and orders, so it wears teal; the take-away share has no good side
function deltaOf(current: number, previous: number, upIsGood: boolean): Pick<Tile, 'delta' | 'look'> {
  const ratio = changeRatio(current, previous)
  if (ratio === null) return { delta: 'Sem base para comparar com ontem', look: 'text-muted' }
  if (Math.round(ratio * 100) === 0) return { delta: 'Igual a ontem', look: 'text-muted' }
  const up = ratio > 0
  const text = `${up ? '▲ +' : '▼ '}${percent.format(ratio)} vs ontem`
  if (!upIsGood) return { delta: text, look: 'text-muted' }
  return { delta: text, look: up ? 'text-teal' : 'text-warning' }
}

export function KpiRow({ today, yesterday }: KpiRowProps) {
  const tiles: Tile[] = [
    {
      label: 'Faturamento',
      value: formatBRL(today.revenueCents),
      ...deltaOf(today.revenueCents, yesterday.revenueCents, true),
    },
    { label: 'Pedidos', value: String(today.orderCount), ...deltaOf(today.orderCount, yesterday.orderCount, true) },
    {
      label: 'Ticket médio',
      value: formatBRL(today.averageTicketCents),
      ...deltaOf(today.averageTicketCents, yesterday.averageTicketCents, true),
    },
    {
      label: 'Para viagem',
      value: percent.format(today.takeAwayShare),
      ...deltaOf(today.takeAwayShare, yesterday.takeAwayShare, false),
    },
  ]

  return (
    <dl className="grid grid-cols-4 overflow-hidden rounded-[20px] border border-line bg-white max-xl:grid-cols-2 max-sm:grid-cols-1">
      {tiles.map((tile, index) => (
        <div
          key={tile.label}
          className="flex flex-col gap-1 border-line p-5 not-first:border-l max-xl:nth-3:border-l-0 max-xl:nth-[n+3]:border-t max-sm:border-l-0 max-sm:not-first:border-t"
        >
          <dt className="text-[15px] font-medium text-muted">{tile.label}</dt>
          <dd className={`font-semibold ${index === 0 ? 'text-[48px] leading-none' : 'text-[32px] leading-tight'}`}>
            {tile.value}
          </dd>
          <dd className={`text-[14px] font-medium ${tile.look}`}>{tile.delta}</dd>
        </div>
      ))}
    </dl>
  )
}
