import { formatBRL } from '../../domain/menu'
import { displayNumber, type PlacedOrder } from '../../domain/order'
import { CheckIcon, ContactlessIcon } from '../icons'
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
    <section className="flex min-h-0 flex-1 flex-col items-center justify-center-safe gap-8 overflow-y-auto bg-teal px-12 py-8 text-center text-white short:gap-4 max-sm:gap-6 max-sm:px-4">
      <span className="flex size-24 items-center justify-center rounded-full bg-white text-teal">
        <CheckIcon size={56} />
      </span>
      <p className="text-[32px] font-semibold max-sm:text-[24px]">Pedido confirmado</p>
      <p aria-label={`Pedido número ${displayNumber(placed.number)}`} className="text-[clamp(140px,24dvh,220px)] leading-none font-bold tabular-nums max-sm:text-[140px]">
        {displayNumber(placed.number)}
      </p>
      <p className="max-w-[560px] text-[26px] text-on-teal max-sm:text-[20px]">Acompanhe seu número na tela do balcão.</p>
      <p className="text-[22px] tabular-nums max-sm:text-[18px]">Total pago {formatBRL(placed.totalCents)}</p>
      <div className="mt-8 flex flex-col items-center gap-4 short:mt-2">
        <button type="button" onClick={onNewOrder} className="h-24 rounded-[24px] bg-white px-12 text-[26px] font-semibold text-teal short:h-20 max-sm:h-20 max-sm:px-8 max-sm:text-[22px]">
          Fazer novo pedido
        </button>
        <p className="text-[18px] text-on-teal tabular-nums">Voltando ao início em {left} s</p>
      </div>
    </section>
  )
}

interface QueueScreenProps {
  menuUrl: string
  totemIsTag: boolean
  onOrderHere: () => void
}

/** Two ways to move the order to the customer's phone: tap the NFC tag (the sticker, or the totem itself) or scan the QR. */
export function QueueScreen({ menuUrl, totemIsTag, onOrderHere }: QueueScreenProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto bg-teal px-12 py-14 text-white short:gap-5 short:py-8 max-sm:gap-6 max-sm:px-4 max-sm:py-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-[56px] leading-tight font-bold short:text-[44px] max-sm:text-[36px]">A fila está grande</h1>
        <p className="text-[26px] text-on-teal short:text-[22px] max-sm:text-[19px]">
          Peça pelo seu celular e retire no balcão. Escolha um dos jeitos:
        </p>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-5 max-sm:grid-cols-1 max-sm:gap-3">
        <section aria-labelledby="queue-nfc" className="flex flex-col items-center gap-5 rounded-[32px] bg-white p-8 text-center text-ink short:gap-3 short:p-6 max-sm:p-5">
          <span className="flex size-[200px] items-center justify-center rounded-full bg-sage-tint text-teal short:size-[150px] max-sm:size-28">
            <ContactlessIcon size={110} />
          </span>
          <h2 id="queue-nfc" className="text-[30px] font-bold max-sm:text-[24px]">Aproxime o celular</h2>
          <p className="text-[22px] text-muted max-sm:text-[18px]">
            {totemIsTag ? 'Encoste o celular atrás do totem.' : 'Encoste o celular no adesivo TOPA ao lado da tela.'}
          </p>
        </section>
        <span aria-hidden="true" className="flex items-center justify-center text-[22px] font-semibold text-on-teal max-sm:py-1">
          ou
        </span>
        <section aria-labelledby="queue-qr" className="flex flex-col items-center gap-5 rounded-[32px] bg-white p-8 text-center text-ink short:gap-3 short:p-6 max-sm:p-5">
          <Qr value={menuUrl} size={200} label="Código para abrir o cardápio no celular" />
          <h2 id="queue-qr" className="text-[30px] font-bold max-sm:text-[24px]">Aponte a câmera</h2>
          <p className="text-[22px] text-muted max-sm:text-[18px]">Leia o código com a câmera do celular.</p>
        </section>
      </div>
      <p className="text-center text-[20px] text-on-teal max-sm:text-[17px]">Os dois abrem o cardápio no celular, sem instalar nada.</p>
      <button type="button" onClick={onOrderHere} className="mt-auto h-24 flex-none rounded-[24px] border-2 border-white text-[26px] font-semibold short:h-20 max-sm:h-20 max-sm:text-[22px]">
        Pedir no totem
      </button>
    </section>
  )
}
