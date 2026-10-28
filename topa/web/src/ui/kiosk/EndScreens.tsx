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
      <span className="flex size-24 items-center justify-center rounded-full bg-white text-teal max-sm:size-20">
        <CheckIcon size={56} className="max-sm:size-12" />
      </span>
      <p className="text-[32px] font-semibold max-sm:text-[22px]">Pedido confirmado</p>
      <p aria-label={`Pedido número ${displayNumber(placed.number)}`} className="text-[clamp(140px,24dvh,220px)] leading-none font-bold tabular-nums max-sm:text-[140px]">
        {displayNumber(placed.number)}
      </p>
      <p className="max-w-[560px] text-[26px] text-on-teal max-sm:text-[17px]">Acompanhe seu número na tela do balcão.</p>
      <p className="text-[22px] tabular-nums max-sm:text-[16px]">Total pago {formatBRL(placed.totalCents)}</p>
      <div className="mt-8 flex flex-col items-center gap-4 short:mt-2 max-sm:mt-2 max-sm:gap-3">
        <button type="button" onClick={onNewOrder} className="h-24 rounded-[24px] bg-white px-12 text-[26px] font-semibold text-teal short:h-20 max-sm:h-16 max-sm:rounded-[20px] max-sm:px-8 max-sm:text-[20px]">
          Fazer novo pedido
        </button>
        <p className="text-[18px] text-on-teal tabular-nums max-sm:text-[15px]">Voltando ao início em {left} s</p>
      </div>
    </section>
  )
}

interface QueueScreenProps {
  menuUrl: string
  totemIsTag: boolean
  onOrderHere: () => void
}

// side by side cards on the tablet; on a phone, each way is a row with its visual on the left
const QUEUE_OPTION =
  'flex flex-col items-center gap-5 rounded-[32px] bg-white p-8 text-center text-ink short:gap-3 short:p-6 max-sm:flex-row max-sm:gap-4 max-sm:rounded-[24px] max-sm:p-4 max-sm:text-left'
const QUEUE_OPTION_TEXT = 'contents max-sm:flex max-sm:flex-col max-sm:gap-1'
const QUEUE_OPTION_TITLE = 'text-[30px] font-bold max-sm:text-[19px] max-sm:leading-tight'
const QUEUE_OPTION_HINT = 'text-[22px] text-muted max-sm:text-[15px] max-sm:leading-snug'

/** Two ways to move the order to the customer's phone: tap the NFC tag (the sticker, or the totem itself) or scan the QR. */
export function QueueScreen({ menuUrl, totemIsTag, onOrderHere }: QueueScreenProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto bg-teal px-12 py-14 text-white short:gap-5 short:py-8 max-sm:gap-4 max-sm:px-4 max-sm:py-6">
      <div className="flex flex-col gap-3 max-sm:gap-2">
        <h1 className="text-[56px] leading-tight font-bold short:text-[44px] max-sm:text-[28px]">A fila está grande</h1>
        <p className="text-[26px] text-on-teal short:text-[22px] max-sm:text-[16px] max-sm:leading-snug">
          Peça pelo seu celular e retire no balcão. Escolha um dos jeitos:
        </p>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-5 max-sm:grid-cols-1 max-sm:gap-3">
        <section aria-labelledby="queue-nfc" className={QUEUE_OPTION}>
          <span className="flex size-[200px] items-center justify-center rounded-full bg-sage-tint text-teal short:size-[150px] max-sm:size-[120px] max-sm:flex-none">
            <ContactlessIcon size={110} className="max-sm:size-16" />
          </span>
          <div className={QUEUE_OPTION_TEXT}>
            <h2 id="queue-nfc" className={QUEUE_OPTION_TITLE}>Aproxime o celular</h2>
            <p className={QUEUE_OPTION_HINT}>
              {totemIsTag ? 'Encoste o celular atrás do totem.' : 'Encoste o celular no adesivo TOPA ao lado da tela.'}
            </p>
          </div>
        </section>
        <span aria-hidden="true" className="flex items-center justify-center text-[22px] font-semibold text-on-teal max-sm:text-[16px]">
          ou
        </span>
        <section aria-labelledby="queue-qr" className={QUEUE_OPTION}>
          <Qr value={menuUrl} size={200} label="Código para abrir o cardápio no celular" className="max-sm:size-[120px] max-sm:flex-none" />
          <div className={QUEUE_OPTION_TEXT}>
            <h2 id="queue-qr" className={QUEUE_OPTION_TITLE}>Aponte a câmera</h2>
            <p className={QUEUE_OPTION_HINT}>Leia o código com a câmera do celular.</p>
          </div>
        </section>
      </div>
      <p className="text-center text-[20px] text-on-teal max-sm:text-[14px]">Os dois abrem o cardápio no celular, sem instalar nada.</p>
      <button type="button" onClick={onOrderHere} className="mt-auto h-24 flex-none rounded-[24px] border-2 border-white text-[26px] font-semibold short:h-20 max-sm:h-16 max-sm:rounded-[20px] max-sm:text-[18px]">
        Pedir no totem
      </button>
    </section>
  )
}
