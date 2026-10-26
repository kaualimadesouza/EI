import { formatBRL } from '../../domain/menu'
import { displayNumber, type PlacedOrder } from '../../domain/order'
import { CheckIcon, PhoneIcon } from './icons'
import { useCountdown } from './use-countdown'
import { Qr } from './Qr'

const RETURN_SECONDS = 20

interface DoneScreenProps {
  placed: PlacedOrder
  onNewOrder: () => void
}

export function DoneScreen({ placed, onNewOrder }: DoneScreenProps) {
  const left = useCountdown(RETURN_SECONDS, onNewOrder)
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-8 bg-teal px-12 text-center text-white">
      <span className="flex size-24 items-center justify-center rounded-full bg-white text-teal">
        <CheckIcon size={56} />
      </span>
      <p className="text-[32px] font-semibold">Pedido confirmado</p>
      <p aria-label={`Pedido número ${displayNumber(placed.number)}`} className="text-[220px] leading-none font-bold tabular-nums max-sm:text-[140px]">
        {displayNumber(placed.number)}
      </p>
      <p className="max-w-[560px] text-[26px] text-on-teal">Acompanhe seu número na tela do balcão.</p>
      <p className="text-[22px] tabular-nums">Total pago {formatBRL(placed.totalCents)}</p>
      <div className="mt-8 flex flex-col items-center gap-4">
        <button type="button" onClick={onNewOrder} className="h-24 rounded-[24px] bg-white px-12 text-[26px] font-semibold text-teal">
          Fazer novo pedido
        </button>
        <p className="text-[18px] text-on-teal tabular-nums">Voltando ao início em {left} s</p>
      </div>
    </section>
  )
}

interface QueueScreenProps {
  menuUrl: string
  onOrderHere: () => void
}

export function QueueScreen({ menuUrl, onOrderHere }: QueueScreenProps) {
  return (
    <section className="flex flex-1 flex-col gap-8 bg-teal px-12 py-14 text-white max-sm:px-4">
      <h1 className="text-[56px] leading-tight font-bold">A fila está grande</h1>
      <p className="text-[26px] text-on-teal">Peça pelo celular e retire no balcão, sem esperar o totem.</p>
      <dl className="grid grid-cols-2 gap-6">
        <div className="rounded-[24px] bg-white/10 p-6">
          <dt className="text-[22px] text-on-teal">No totem</dt>
          <dd className="text-[44px] font-bold tabular-nums">~8 min</dd>
        </div>
        <div className="rounded-[24px] bg-white p-6 text-ink">
          <dt className="text-[22px] text-muted">Pelo celular</dt>
          <dd className="text-[44px] font-bold tabular-nums">~2 min</dd>
        </div>
      </dl>
      <div className="flex items-center gap-8 rounded-[32px] bg-ink p-8 max-sm:flex-col">
        <Qr value={menuUrl} size={240} label="Código para abrir o cardápio no celular" />
        <div className="flex flex-col gap-4">
          <p className="text-[26px] font-semibold">Aponte a câmera do celular para o código.</p>
          <p className="flex items-start gap-3 text-[22px] text-on-teal">
            <PhoneIcon size={32} className="flex-none" />
            Tem o app TOPA? Aproxime o celular do adesivo TOPA ao lado da tela.
          </p>
        </div>
      </div>
      <button type="button" onClick={onOrderHere} className="mt-auto h-24 rounded-[24px] border-2 border-white text-[26px] font-semibold">
        Pedir no totem
      </button>
    </section>
  )
}
