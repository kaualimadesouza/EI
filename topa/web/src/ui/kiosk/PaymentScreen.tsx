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

const PIX_SECONDS = 300

export function PaymentScreen(props: PaymentScreenProps) {
  const { totalCents, method, payment, error, onMethod, onApprove, onDecline, onBackToBag } = props
  const busy = payment === 'processing'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-12 py-8 [scrollbar-width:none] short:py-6 max-sm:p-4">
      {/* side by side on a wide landscape screen: choices on the left, what to do now on the right */}
      <div className="mx-auto flex w-full max-w-[880px] flex-1 flex-col gap-6 max-sm:gap-4 lg:landscape:grid lg:landscape:max-w-[1200px] lg:landscape:grid-cols-2 lg:landscape:content-start lg:landscape:gap-x-10">
        <div className="flex items-baseline justify-between gap-4 max-sm:flex-col max-sm:gap-1 lg:landscape:col-start-1 lg:landscape:flex-col lg:landscape:gap-1">
          <h1 className="text-[44px] leading-tight font-bold short:text-[36px] max-sm:text-[30px]">Como você quer pagar?</h1>
          <span className="text-[44px] font-bold whitespace-nowrap tabular-nums short:text-[36px] max-sm:text-[30px]">{formatBRL(totalCents)}</span>
        </div>
        <div className="grid grid-cols-2 gap-6 max-sm:gap-3 lg:landscape:col-start-1">
          <MethodTile selected={method === 'card'} disabled={busy} label="Cartão ou celular" onClick={() => onMethod('card')}>
            <CardIcon size={40} />
          </MethodTile>
          <MethodTile selected={method === 'pix'} disabled={busy} label="Pix" onClick={() => onMethod('pix')}>
            <PixIcon size={40} />
          </MethodTile>
        </div>
        <section className="flex min-h-[420px] flex-1 flex-col items-center justify-between gap-6 rounded-[32px] border border-line bg-white p-8 text-center short:min-h-0 max-sm:min-h-0 max-sm:gap-4 max-sm:p-5 lg:landscape:col-start-2 lg:landscape:row-span-3 lg:landscape:row-start-1">
          {payment === 'processing' && <p role="status" className="my-auto text-[32px] font-semibold max-sm:text-[24px]">Processando o pagamento...</p>}
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
            <button type="button" onClick={onApprove} className="min-h-16 text-[18px] font-medium text-muted underline underline-offset-4">
              Simular aprovação (demo)
            </button>
            <button type="button" onClick={onDecline} className="min-h-16 text-[18px] font-medium text-muted underline underline-offset-4">
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
      className={`relative flex min-h-40 flex-col items-start justify-between gap-3 rounded-[24px] p-6 text-left text-[26px] leading-tight font-semibold short:min-h-32 short:text-[22px] max-sm:min-h-32 max-sm:p-4 max-sm:text-[20px] ${
        selected ? 'border-4 border-teal bg-sage-tint' : 'border-2 border-slate bg-white'
      }`}
    >
      {children}
      {label}
      {selected && (
        <span className="absolute top-5 right-5 flex size-10 items-center justify-center rounded-full bg-teal text-white max-sm:top-3 max-sm:right-3 max-sm:size-8">
          <CheckIcon size={24} />
        </span>
      )}
    </button>
  )
}

function CardInstructions() {
  return (
    <>
      <p className="text-[26px] font-semibold max-sm:text-[20px]">Aproxime o cartão ou o celular da parte de trás do totem.</p>
      <ContactlessIcon size={140} className="text-teal" />
      <p className="flex flex-col items-center gap-2 text-[22px] font-semibold text-teal max-sm:text-[18px]">
        Encoste aqui, atrás da tela
        <ArrowDownIcon size={48} />
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
      <div className="my-auto flex flex-col items-center gap-6">
        <p className="text-[26px] font-semibold max-sm:text-[20px]">O código Pix expirou.</p>
        <button type="button" onClick={() => setRound((r) => r + 1)} className="h-20 rounded-[24px] bg-teal px-10 text-[22px] font-semibold text-white">
          Gerar novo código
        </button>
      </div>
    )
  }
  return (
    <>
      <p className="text-[26px] font-semibold max-sm:text-[20px]">Abra o app do seu banco e leia o código.</p>
      <Qr value={`TOPA-PIX-DEMO-${totalCents}-${round}`} size={260} label="Código Pix de demonstração" />
      <p className="text-[22px] text-muted tabular-nums max-sm:text-[18px]">O código vale por {clock}</p>
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
    <div role="alert" className="my-auto flex flex-col items-center gap-6">
      <p className="text-[26px] font-semibold text-warning max-sm:text-[20px]">{message}</p>
      <div className="flex flex-wrap justify-center gap-4">
        {secondary && (
          <button type="button" onClick={onSecondary} className="h-[88px] rounded-[24px] border-2 border-slate px-8 text-[22px] font-semibold">
            {secondary}
          </button>
        )}
        <button type="button" onClick={onPrimary} className="h-[88px] rounded-[24px] bg-teal px-8 text-[22px] font-semibold text-white">
          {primary}
        </button>
      </div>
    </div>
  )
}
