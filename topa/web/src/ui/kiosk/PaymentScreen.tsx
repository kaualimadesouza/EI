import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { formatBRL } from '../../domain/menu'
import type { PaymentPort, PixChargeInfo } from '../../ports/payment'
import { ArrowDownIcon, CardIcon, CheckIcon, ContactlessIcon, PixIcon } from '../icons'
import type { KioskState } from './flow'
import { PRIMARY_ACTION, SECONDARY_ACTION } from './parts'
import { Qr } from './Qr'
import { useCountdown } from './use-countdown'

interface PaymentScreenProps {
  totalCents: number
  method: KioskState['paymentMethod']
  payment: KioskState['payment']
  error: string | null
  surface?: 'totem' | 'phone'
  paymentPort?: PaymentPort
  orderId?: string
  isDemo?: boolean
  onMethod: (method: KioskState['paymentMethod']) => void
  onApprove: () => void
  onDecline: () => void
  onBackToBag: () => void
}

export const PIX_SECONDS = 300

export function PaymentScreen(props: PaymentScreenProps) {
  const {
    totalCents,
    method,
    payment,
    error,
    surface = 'totem',
    paymentPort,
    orderId,
    isDemo = true,
    onMethod,
    onApprove,
    onDecline,
    onBackToBag,
  } = props
  const busy = payment === 'processing'
  const allowCard = surface === 'totem'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-12 py-8 [scrollbar-width:none] short:py-6 max-sm:p-4">
      {/* side by side on a wide landscape screen: choices on the left, what to do now on the right */}
      <div className="mx-auto flex w-full max-w-[880px] flex-1 flex-col gap-6 max-sm:gap-4 lg:landscape:grid lg:landscape:max-w-[1200px] lg:landscape:grid-cols-2 lg:landscape:content-start lg:landscape:gap-x-10">
        <div className="flex items-baseline justify-between gap-4 max-sm:flex-col max-sm:gap-1 lg:landscape:col-start-1 lg:landscape:flex-col lg:landscape:gap-1">
          <h1 className="text-title leading-tight font-bold">
            {allowCard ? 'Como você quer pagar?' : 'Pague com Pix'}
          </h1>
          <span className="text-title font-bold whitespace-nowrap tabular-nums">{formatBRL(totalCents)}</span>
        </div>
        {allowCard && (
          <div className="grid grid-cols-2 gap-6 max-sm:gap-3 lg:landscape:col-start-1">
            <MethodTile selected={method === 'card'} disabled={busy} label="Cartão ou celular" onClick={() => onMethod('card')}>
              <CardIcon size={40} className="phone:size-8" />
            </MethodTile>
            <MethodTile selected={method === 'pix'} disabled={busy} label="Pix" onClick={() => onMethod('pix')}>
              <PixIcon size={40} className="phone:size-8" />
            </MethodTile>
          </div>
        )}
        <section className="flex min-h-[420px] flex-1 flex-col items-center justify-between gap-6 rounded-panel border border-line bg-white p-8 text-center short:min-h-0 max-sm:min-h-0 max-sm:gap-4 max-sm:p-5 lg:landscape:col-start-2 lg:landscape:row-span-3 lg:landscape:row-start-1">
          {payment === 'processing' && <p role="status" className="my-auto text-heading font-semibold">Processando o pagamento...</p>}
          {payment === 'declined' &&
            (allowCard ? (
              <Problem
                message="Pagamento não aprovado. Tente de novo ou pague com Pix."
                primary="Tentar de novo"
                onPrimary={() => onMethod(method)}
                secondary="Pagar com Pix"
                onSecondary={() => onMethod('pix')}
              />
            ) : (
              <Problem
                message="Pagamento não confirmado. Tente de novo."
                primary="Tentar de novo"
                onPrimary={() => onMethod('pix')}
              />
            ))}
          {payment === 'failed' && (
            <Problem message={error} primary="Voltar ao pedido" onPrimary={onBackToBag} />
          )}
          {payment === 'choosing' &&
            (allowCard && method === 'card' ? (
              <CardInstructions />
            ) : (
              <PixInstructions
                totalCents={totalCents}
                onPhone={!allowCard}
                paymentPort={paymentPort}
                orderId={orderId}
                onApproved={onApprove}
              />
            ))}
        </section>
        {payment === 'choosing' && isDemo && (
          <div className="flex flex-wrap justify-center gap-x-8 phone:gap-y-2 lg:landscape:col-start-1">
            <button type="button" onClick={onApprove} className="min-h-16 text-caption font-medium text-muted underline underline-offset-4">
              Simular aprovação (demo)
            </button>
            <button type="button" onClick={onDecline} className="min-h-16 text-caption font-medium text-muted underline underline-offset-4">
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
      className={`relative flex min-h-40 cursor-pointer flex-col items-start justify-between gap-3 rounded-control p-6 text-left text-[26px] leading-tight font-semibold transition-[transform,background-color,border-color] duration-150 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none short:min-h-32 short:text-[22px] max-sm:min-h-32 max-sm:p-4 max-sm:text-[20px] phone:min-h-0 phone:gap-2 phone:text-label ${
        selected ? 'border-4 border-teal bg-sage-tint' : 'border-2 border-slate bg-white'
      }`}
    >
      {children}
      {label}
      {selected && (
        <span className="absolute top-5 right-5 flex size-10 items-center justify-center rounded-full bg-teal text-white motion-safe:animate-badge-pop max-sm:top-3 max-sm:right-3 max-sm:size-8 phone:size-7">
          <CheckIcon size={24} className="phone:size-5" />
        </span>
      )}
    </button>
  )
}

function CardInstructions() {
  return (
    <>
      <p className="text-lead font-semibold phone:leading-snug">Aproxime o cartão ou o celular da parte de trás do totem.</p>
      <div className="relative flex items-center justify-center">
        <span className="absolute size-44 rounded-full bg-teal/10 motion-safe:animate-beacon phone:size-32" />
        <ContactlessIcon size={140} className="relative text-teal phone:size-24" />
      </div>
      <p className="flex flex-col items-center gap-2 text-body font-semibold text-teal phone:gap-1">
        Encoste aqui, atrás da tela
        <ArrowDownIcon size={48} className="phone:size-9" />
      </p>
    </>
  )
}

interface PixInstructionsProps {
  totalCents: number
  onPhone: boolean
  paymentPort?: PaymentPort
  orderId?: string
  onApproved?: () => void
}

function PixInstructions({ totalCents, onPhone, paymentPort, orderId, onApproved }: PixInstructionsProps) {
  const [round, setRound] = useState(0)
  const [charge, setCharge] = useState<PixChargeInfo | null>(null)
  const [copyState, setCopyState] = useState<{ round: number; status: 'copied' | 'failed' } | null>(null)
  const left = useCountdown(PIX_SECONDS, () => {}, round)
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
  const isExpired = left === 0
  const onApprovedRef = useRef(onApproved)
  onApprovedRef.current = onApproved

  useEffect(() => {
    let active = true
    if (paymentPort) {
      paymentPort
        .createPixCharge(orderId || `demo-order-${round}`, totalCents, 'Pedido TOPA')
        .then((created) => {
          if (active) {
            setCharge(created)
          }
        })
        .catch(() => {
          // Keep fallback on network error
        })
    }
    return () => {
      active = false
    }
  }, [paymentPort, orderId, totalCents, round])

  useEffect(() => {
    if (!paymentPort || !charge || charge.status === 'PAID' || isExpired) {
      return
    }

    const interval = setInterval(async () => {
      try {
        const updated = await paymentPort.getPaymentStatus(charge.id)
        if (updated.status === 'PAID') {
          clearInterval(interval)
          onApprovedRef.current?.()
        }
      } catch {
        // Polling retry
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [paymentPort, charge, isExpired])

  const code = charge?.brCode || `TOPA-PIX-DEMO-${totalCents}-${round}`

  const copyCode = () => {
    try {
      if (!navigator.clipboard?.writeText) {
        setCopyState({ round, status: 'failed' })
        return
      }
      navigator.clipboard
        .writeText(code)
        .then(() => setCopyState({ round, status: 'copied' }))
        .catch(() => setCopyState({ round, status: 'failed' }))
    } catch {
      setCopyState({ round, status: 'failed' })
    }
  }

  const qrElement = useMemo(() => {
    if (charge?.brCodeBase64) {
      return (
        <img
          src={charge.brCodeBase64}
          alt="QR Code Pix"
          className="size-[260px] rounded-control border border-line bg-white p-3 phone:size-[220px]"
        />
      )
    }
    return <Qr value={code} size={onPhone ? 220 : 260} label="Código Pix de demonstração" />
  }, [charge?.brCodeBase64, code, onPhone])

  if (left === 0) {
    return (
      <div className="my-auto flex flex-col items-center gap-6 phone:gap-4">
        <p className="text-lead font-semibold">O código Pix expirou.</p>
        <button type="button" onClick={() => setRound((r) => r + 1)} className={`${PRIMARY_ACTION} h-20 px-10 text-[22px] phone:px-8`}>
          Gerar novo código
        </button>
      </div>
    )
  }
  return (
    <>
      <p className="text-lead font-semibold phone:leading-snug">
        {onPhone ? 'Copie o código Pix e pague no app do seu banco.' : 'Abra o app do seu banco e leia o código.'}
      </p>
      {qrElement}
      {onPhone && (
        <button
          type="button"
          onClick={copyCode}
          className={`${SECONDARY_ACTION} h-16 px-8 text-label text-ink`}
        >
          {copyState?.round === round && copyState.status === 'copied' ? 'Código copiado' : 'Copiar código Pix'}
        </button>
      )}
      {copyState?.round === round && copyState.status === 'failed' && (
        <p className="rounded-control bg-ground-2 px-4 py-2 font-mono text-caption select-all">{code}</p>
      )}
      <p className="text-body text-muted tabular-nums">O código vale por {clock}</p>
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
    <div role="alert" className="my-auto flex flex-col items-center gap-6 phone:w-full phone:gap-4">
      <p className="text-lead font-semibold text-warning phone:leading-snug">{message}</p>
      <div className="flex flex-wrap justify-center gap-4 phone:w-full phone:flex-col phone:gap-3">
        {secondary && (
          <button type="button" onClick={onSecondary} className={`${SECONDARY_ACTION} h-[88px] px-8 text-[22px]`}>
            {secondary}
          </button>
        )}
        <button type="button" onClick={onPrimary} className={`${PRIMARY_ACTION} h-[88px] px-8 text-[22px]`}>
          {primary}
        </button>
      </div>
    </div>
  )
}
