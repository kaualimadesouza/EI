import type { ReactNode } from 'react'

import { formatBRL } from '../../domain/menu'
import { displayNumber, type PlacedOrder } from '../../domain/order'
import { CheckIcon, ContactlessIcon } from '../icons'
import { KIOSK_ACTION } from './parts'
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
      <span className="flex size-24 items-center justify-center rounded-full bg-white text-teal phone:size-20">
        <CheckIcon size={56} className="phone:size-12" />
      </span>
      <p className="text-heading font-semibold">Pedido confirmado</p>
      <p aria-label={`Pedido número ${displayNumber(placed.number)}`} className="text-[clamp(140px,24dvh,220px)] leading-none font-bold tabular-nums max-sm:text-[140px]">
        {displayNumber(placed.number)}
      </p>
      <p className="max-w-[560px] text-lead text-on-teal">Acompanhe seu número na tela do balcão.</p>
      <p className="text-body tabular-nums">Total pago {formatBRL(placed.totalCents)}</p>
      <div className="mt-8 flex flex-col items-center gap-4 short:mt-2 phone:mt-2 phone:gap-3">
        <button
          type="button"
          onClick={onNewOrder}
          className={`${KIOSK_ACTION} h-24 bg-white px-12 text-[26px] text-teal short:h-20 max-sm:h-20 max-sm:px-8 max-sm:text-[22px]`}
        >
          Fazer novo pedido
        </button>
        <p className="text-caption text-on-teal tabular-nums">Voltando ao início em {left} s</p>
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
    <section className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto bg-teal px-12 py-14 text-white short:gap-5 short:py-8 max-sm:gap-6 max-sm:px-4 max-sm:py-8 phone:gap-4 phone:py-6">
      <div className="flex flex-col gap-3 phone:gap-2">
        <h1 className="text-[56px] leading-tight font-bold short:text-[44px] max-sm:text-[36px] phone:text-title">A fila está grande</h1>
        <p className="text-[26px] text-on-teal short:text-[22px] max-sm:text-[19px] phone:text-body phone:leading-snug">
          Peça pelo seu celular e retire no balcão. Escolha um dos jeitos:
        </p>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-5 max-sm:grid-cols-1 max-sm:gap-3">
        <QueueOption
          labelId="queue-nfc"
          title="Aproxime o celular"
          hint={totemIsTag ? 'Encoste o celular atrás do totem.' : 'Encoste o celular no adesivo TOPA ao lado da tela.'}
          row
        >
          <span className="flex size-[200px] items-center justify-center rounded-full bg-sage-tint text-teal short:size-[150px] max-sm:size-28 phone:size-20 phone:flex-none">
            <ContactlessIcon size={110} className="phone:size-11" />
          </span>
        </QueueOption>
        <span aria-hidden="true" className="flex items-center justify-center text-[22px] font-semibold text-on-teal max-sm:py-1 phone:py-0 phone:text-body">
          ou
        </span>
        <QueueOption labelId="queue-qr" title="Aponte a câmera" hint="Leia o código com a câmera do celular.">
          <Qr value={menuUrl} size={200} label="Código para abrir o cardápio no celular" className="phone:size-44" />
        </QueueOption>
      </div>
      <p className="text-center text-[20px] text-on-teal max-sm:text-[17px] phone:text-caption">Os dois abrem o cardápio no celular, sem instalar nada.</p>
      <button
        type="button"
        onClick={onOrderHere}
        className={`${KIOSK_ACTION} mt-auto h-24 flex-none border-2 border-white text-[26px] short:h-20 max-sm:h-20 max-sm:text-[22px]`}
      >
        Pedir no totem
      </button>
    </section>
  )
}

interface QueueOptionProps {
  labelId: string
  title: string
  hint: string
  /** On a phone the option becomes a row; the QR stays a column, large enough for another phone to scan. */
  row?: boolean
  children: ReactNode
}

function QueueOption({ labelId, title, hint, row = false, children }: QueueOptionProps) {
  return (
    <section
      aria-labelledby={labelId}
      className={`flex flex-col items-center gap-5 rounded-panel bg-white p-8 text-center text-ink short:gap-3 short:p-6 max-sm:p-5 phone:p-4 ${
        row ? 'phone:flex-row phone:gap-4 phone:text-left' : 'phone:gap-3'
      }`}
    >
      {children}
      <div className={`flex flex-col items-center gap-5 short:gap-3 phone:gap-1 ${row ? 'phone:items-start' : ''}`}>
        <h2 id={labelId} className="text-[30px] font-bold max-sm:text-[24px] phone:text-label phone:leading-tight">
          {title}
        </h2>
        <p className="text-body text-muted phone:leading-snug">{hint}</p>
      </div>
    </section>
  )
}
