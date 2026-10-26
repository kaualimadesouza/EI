import type { HourCount } from '../../domain/metrics'

interface HourlyChartProps {
  byHour: readonly HourCount[]
  currentHour: number
}

const PLOT_HEIGHT = 160

/** One teal column per store hour; the peak carries its value, the rest live in the tooltip and the table. */
export function HourlyChart({ byHour, currentHour }: HourlyChartProps) {
  const peak = Math.max(...byHour.map((h) => h.count))
  const scale = Math.max(peak, 1)

  return (
    <figure className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-5">
      <figcaption className="flex items-baseline justify-between gap-4">
        <span className="text-[18px] font-semibold">Pedidos por hora</span>
        <span className="text-[14px] text-muted">Hoje, das 7h às 22h</span>
      </figcaption>
      <div aria-hidden="true" className="relative border-b border-line" style={{ height: PLOT_HEIGHT }}>
        <div className="absolute inset-x-0 top-0 border-t border-line" />
        <span className="absolute -top-2.5 right-0 bg-white pl-1 text-[12px] text-muted tabular-nums">{scale}</span>
        <div className="absolute inset-0 flex items-end gap-0.5 pr-8">
          {byHour.map((slot) => (
            <div key={slot.hour} className="group relative flex h-full flex-1 items-end justify-center">
              <div
                className={`w-full max-w-6 rounded-t-[4px] ${slot.hour === currentHour ? 'bg-teal' : 'bg-slate'}`}
                style={{ height: `${(slot.count / scale) * 100}%` }}
              />
              {slot.count === peak && peak > 0 && (
                <span className="absolute text-[12px] font-semibold tabular-nums" style={{ bottom: `calc(${(slot.count / scale) * 100}% + 4px)` }}>
                  {slot.count}
                </span>
              )}
              <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-[8px] bg-ink px-2 py-1 text-[12px] whitespace-nowrap text-white group-hover:block">
                {slot.hour}h: {slot.count} {slot.count === 1 ? 'pedido' : 'pedidos'}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="flex gap-0.5 pr-8">
        {byHour.map((slot) => (
          <span
            key={slot.hour}
            className={`flex-1 text-center text-[12px] tabular-nums ${slot.hour === currentHour ? 'font-semibold text-ink' : 'text-muted'}`}
          >
            {slot.hour % 3 === 1 || slot.hour === currentHour ? `${slot.hour}h` : ''}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Pedidos por hora, hoje</caption>
        <thead>
          <tr>
            <th scope="col">Hora</th>
            <th scope="col">Pedidos</th>
          </tr>
        </thead>
        <tbody>
          {byHour.map((slot) => (
            <tr key={slot.hour}>
              <td>{slot.hour}h</td>
              <td>{slot.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
