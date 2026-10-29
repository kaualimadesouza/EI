import { useEffect, useState } from 'react'

import type { ConnectionPort } from '../../ports/connection'
import { BrandMark } from '../BrandMark'
import { DineInIcon, StoreMark, TakeAwayIcon } from '../icons'

interface ServerStatusProps {
  mode: 'api' | 'demo'
  connection: ConnectionPort
}

interface StartScreenProps {
  storeName: string | null
  allowCard?: boolean
  /** Present on the store's totem; omitted on the customer's own phone. */
  serverStatus?: ServerStatusProps
  onBegin: (dineIn: boolean) => void
  /** Absent on the customer's own phone, where there is no queue to send away. */
  onQueue?: () => void
  onSwitchRole?: () => void
}

interface StatusLook {
  label: string
  dot: string
}

const PLACES = [
  { dineIn: true, label: 'Comer aqui', Icon: DineInIcon },
  { dineIn: false, label: 'Levar para viagem', Icon: TakeAwayIcon },
] as const

function lookOf(status: 'checking' | 'demo' | 'online' | 'offline'): StatusLook {
  switch (status) {
    case 'checking':
      return { label: 'Verificando conexão', dot: 'bg-sage' }
    case 'demo':
      return { label: 'Modo demonstração', dot: 'bg-sage' }
    case 'online':
      return { label: 'Servidor conectado', dot: 'bg-white' }
    case 'offline':
      return { label: 'Servidor sem resposta: chame um atendente', dot: 'bg-warning-tint' }
  }
}

function ServerStatus({ mode, connection }: ServerStatusProps) {
  const [reachability, setReachability] = useState<'checking' | 'online' | 'offline'>('checking')

  useEffect(() => {
    let current = true
    void connection.isReachable().then((reachable) => {
      if (current) setReachability(reachable ? 'online' : 'offline')
    })
    return () => {
      current = false
    }
  }, [connection])

  // demo mode is known up front; only the API's reachability is worth waiting for
  const look = lookOf(mode === 'demo' ? 'demo' : reachability)
  return (
    <p role="status" className="flex items-center gap-3 text-caption font-medium phone:gap-2">
      <span aria-hidden="true" className={`size-3 rounded-full phone:size-2.5 phone:flex-none ${look.dot}`} />
      {look.label}
    </p>
  )
}

export function StartScreen({
  storeName,
  allowCard = true,
  serverStatus,
  onBegin,
  onQueue,
  onSwitchRole,
}: StartScreenProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-teal text-white lg:landscape:flex-row">
      <div className="relative h-[clamp(14rem,36dvh,28rem)] flex-none max-sm:h-48 phone:h-auto phone:min-h-40 phone:flex-1 lg:landscape:h-auto lg:landscape:w-[46%] short:lg:landscape:w-[38%]">
        <img src={`${import.meta.env.BASE_URL}photos/xsalada.jpg`} alt="" className="absolute inset-0 size-full object-cover" />
        {storeName && (
          <div className="absolute inset-x-[clamp(1rem,6vw,3rem)] top-[clamp(1rem,5vw,2.5rem)] flex items-center">
            <span className="flex h-14 items-center gap-3 rounded-full bg-white pr-5 pl-2 text-[clamp(1rem,2.5vw,1.375rem)] font-semibold whitespace-nowrap text-ink phone:h-11 phone:gap-2 phone:pr-4 phone:pl-1.5">
              <StoreMark className="phone:size-8" />
              {storeName}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-6 p-[clamp(1rem,6vw,3rem)] short:gap-3 max-sm:gap-4 phone:flex-none lg:landscape:justify-center-safe lg:landscape:overflow-y-auto lg:landscape:p-16 short:lg:landscape:p-10">
        <h1 className="text-[clamp(3rem,11vw,5.5rem)] leading-[0.95] font-bold tracking-[-0.04em] phone:text-[34px] phone:leading-none phone:tracking-[-0.03em] phone:text-balance lg:landscape:text-[clamp(2.5rem,min(5.5vw,9dvh),5.5rem)]">
          Peça aqui. Pague aqui.
        </h1>
        <p className="max-w-[600px] text-[clamp(1.125rem,3.25vw,1.625rem)] leading-[1.35] text-on-teal short:text-[20px] phone:text-body phone:leading-snug">
          {allowCard
            ? 'Monte o pedido, pague por aproximação ou Pix e retire no balcão.'
            : 'Monte o pedido, pague com Pix e retire no balcão.'}
        </p>
        <p className="mt-auto text-[32px] font-semibold short:text-[26px] max-sm:text-[24px] phone:text-heading lg:landscape:mt-6 short:lg:landscape:mt-2">Onde você vai comer?</p>
        <div className="grid grid-cols-2 gap-6 max-sm:gap-3">
          {PLACES.map(({ dineIn, label, Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => onBegin(dineIn)}
              className="flex min-h-40 flex-col items-start justify-between gap-3 rounded-panel bg-white p-6 text-left text-[32px] leading-tight font-semibold text-ink short:min-h-32 short:text-[26px] max-sm:min-h-32 max-sm:p-4 max-sm:text-[22px] phone:min-h-0 phone:gap-2 phone:text-label"
            >
              <Icon size={44} className="text-teal phone:size-8" />
              {label}
            </button>
          ))}
        </div>
        {onQueue && (
          <button
            type="button"
            onClick={onQueue}
            className="min-h-16 self-start text-left text-[22px] font-medium underline underline-offset-4 short:text-[20px] max-sm:text-[18px] phone:text-body"
          >
            A fila está grande? Peça pelo celular
          </button>
        )}
        <div className="flex items-center justify-between gap-4 text-on-teal">
          {serverStatus && <ServerStatus {...serverStatus} />}
          <BrandMark label="por TOPA" className="ml-auto text-caption font-medium phone:whitespace-nowrap" onStaffTaps={onSwitchRole} />
        </div>
      </div>
    </section>
  )
}
