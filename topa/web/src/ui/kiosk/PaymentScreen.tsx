import { useState, type ReactNode } from 'react'

import { formatBRL } from '../../domain/menu'
import type { KioskState } from './flow'
import { ArrowDownIcon, CardIcon, CheckIcon, ContactlessIcon, PixIcon } from '../icons'
import { useCountdown } from './use-countdown'
import { Qr } from './Qr'

interface PaymentScreenProps {
  totalCents: number
  method: KioskState['paymentMethod']
  payment: KioskState['payment']
  error: string | null
  onMethod: (method: KioskState['paymentMethod']) => void
  onApprove: () => void
  onDecline: () => void
  onBackToBag: () => void
}

export const PIX_SECONDS = 300

export function PaymentScreen(props: PaymentScreenProps) {
  const { totalCents, method, payment, error, onMethod, onApprove, onDecline, onBackToBag } = props
  const busy = payment === 'processing'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-12 py-8 [scrollbar-width:none] short:py-6 max-sm:p-4">
      {/* side by side on a wide landscape screen: choices on the left, what to do now on the right */}
      <div className="mx-auto flex w-full max-w-[880px] flex-1 flex-col gap-6 max-sm:gap-4 lg:landscape:grid lg:landscape:max-w-[1200px] lg:landscape:grid-cols-2 lg:landscape:content-start lg:landscape:gap-x-10">
        <div className="flex items-baseline justify-between gap-4 max-sm:flex-col max-sm:gap-1 lg:landscape:col-start-1 lg:landscape:flex-col lg:landscape:gap-1">
          <h1 className="text-[44px] leading-tight font-bold short:text-[36px] max-sm:text-[24px]">Como você quer pagar?</h1>
          <span className="text-[44px] font-bold whitespace-nowrap tabular-nums short:text-[36px] max-sm:text-[24px]">{formatBRL(totalCents)}</span>
        </div>
        <div className="grid grid-cols-2 gap-6 max-sm:gap-3 lg:landscape:col-start-1">
          <MethodTile selected={method === 'card'} disabled={busy} label="Cartão ou celular" onClick={() => onMethod('card')}>
            <CardIcon size={40} className="max-sm:size-8" />
          </MethodTile>
          <MethodTile selected={method === 'pix'} disabled={busy} label="Pix" onClick={() => onMethod('pix')}>
            <PixIcon size={40} className="max-sm:size-8" />
          </MethodTile>
        </div>
        <section className="flex min-h-[420px] flex-1 flex-col items-center justify-between gap-6 rounded-[32px] border border-line bg-white p-8 text-center short:min-h-0 max-sm:min-h-0 max-sm:gap-4 max-sm:rounded-[24px] max-sm:p-5 lg:landscape:col-start-2 lg:landscape:row-span-3 lg:landscape:row-start-1">
          {payment === 'processing' && <p role="status" className="my-auto text-[32px] font-semibold max-sm:text-[20px]">Processando o pagamento...</p>}
          {payment === 'declined' && (
            <Problem
              message="Pagamento não aprovado. Tente de novo ou pague com Pix."
              primary="Tentar de novo"
              onPrimary={() => onMethod(method)}
              secondary="Pagar com Pix"
              onSecondary={() => onMethod('pix')}
            />
          )}
          {payment === 'failed' && (
            <Problem message={error} primary="Voltar ao pedido" onPrimary={onBackToBag} />
          )}
          {payment === 'choosing' && (method === 'card' ? <CardInstructions /> : <PixInstructions totalCents={totalCents} />)}
        </section>
        {payment === 'choosing' && (
          <div className="flex flex-wrap justify-center gap-x-8 lg:landscape:col-start-1">
            <button type="button" onClick={onApprove} className="min-h-16 text-[18px] font-medium text-muted underline underline-offset-4 max-sm:text-[15px]">
              Simular aprovação (demo)
            </button>
            <button type="button" onClick={onDecline} className="min-h-16 text-[18px] font-medium text-muted underline underline-offset-4 max-sm:text-[15px]">
              Simular recusa (demo)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface MethodTileProps {
  selected: boolean
  disabled: boolean
  label: string
  onClick: () => void
  children: ReactNode
}

function MethodTile({ selected, disabled, label, onClick, children }: MethodTileProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`relative flex min-h-40 flex-col items-start justify-between gap-3 rounded-[24px] p-6 text-left text-[26px] leading-tight font-semibold short:min-h-32 short:text-[22px] max-sm:min-h-0 max-sm:gap-2 max-sm:rounded-[20px] max-sm:p-4 max-sm:text-[18px] ${
        selected ? 'border-4 border-teal bg-sage-tint' : 'border-2 border-slate bg-white'
      }`}
    >
      {children}
      {label}
      {selected && (
        <span className="absolute top-5 right-5 flex size-10 items-center justify-center rounded-full bg-teal text-white max-sm:top-3 max-sm:right-3 max-sm:size-7">
          <CheckIcon size={24} className="max-sm:size-5" />
        </span>
      )}
    </button>
  )
}

function CardInstructions() {
  return (
    <>
      <p className="text-[26px] font-semibold max-sm:text-[17px] max-sm:leading-snug">Aproxime o cartão ou o celular da parte de trás do totem.</p>
      <ContactlessIcon size={140} className="text-teal max-sm:size-24" />
      <p className="flex flex-col items-center gap-2 text-[22px] font-semibold text-teal max-sm:gap-1 max-sm:text-[16px]">
        Encoste aqui, atrás da tela
        <ArrowDownIcon size={48} className="max-sm:size-9" />
      </p>
    </>
  )
}

function PixInstructions({ totalCents }: { totalCents: number }) {
  const [round, setRound] = useState(0)
  const left = useCountdown(PIX_SECONDS, () => {}, round)
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`

  if (left === 0) {
    return (
      <div className="my-auto flex flex-col items-center gap-6 max-sm:gap-4">
        <p className="text-[26px] font-semibold max-sm:text-[17px]">O código Pix expirou.</p>
        <button type="button" onClick={() => setRound((r) => r + 1)} className="h-20 rounded-[24px] bg-teal px-10 text-[22px] font-semibold text-white max-sm:h-16 max-sm:rounded-[20px] max-sm:px-8 max-sm:text-[18px]">
          Gerar novo código
        </button>
      </div>
    )
  }
  return (
    <>
      <p className="text-[26px] font-semibold max-sm:text-[17px] max-sm:leading-snug">Abra o app do seu banco e leia o código.</p>
      <Qr value={`TOPA-PIX-DEMO-${totalCents}-${round}`} size={260} label="Código Pix de demonstração" />
      <p className="text-[22px] text-muted tabular-nums max-sm:text-[15px]">O código vale por {clock}</p>
    </>
  )
}

interface ProblemProps {
  message: string | null
  primary: string
  onPrimary: () => void
  secondary?: string
  onSecondary?: () => void
}

function Problem({ message, primary, onPrimary, secondary, onSecondary }: ProblemProps) {
  return (
    <div role="alert" className="my-auto flex flex-col items-center gap-6 max-sm:w-full max-sm:gap-4">
      <p className="text-[26px] font-semibold text-warning max-sm:text-[17px] max-sm:leading-snug">{message}</p>
      <div className="flex flex-wrap justify-center gap-4 max-sm:w-full max-sm:flex-col max-sm:gap-3">
        {secondary && (
          <button type="button" onClick={onSecondary} className="h-[88px] rounded-[24px] border-2 border-slate px-8 text-[22px] font-semibold max-sm:h-16 max-sm:rounded-[20px] max-sm:text-[18px]">
            {secondary}
          </button>
        )}
        <button type="button" onClick={onPrimary} className="h-[88px] rounded-[24px] bg-teal px-8 text-[22px] font-semibold text-white max-sm:h-16 max-sm:rounded-[20px] max-sm:text-[18px]">
          {primary}
        </button>
      </div>
    </div>
  )
}
