import { useEffect, useState } from 'react'

import type { ConnectionPort } from '../../ports/connection'
import { DineInIcon, StoreMark, TakeAwayIcon } from './icons'

interface StartScreenProps {
  mode: 'api' | 'demo'
  connection: ConnectionPort
  onBegin: (dineIn: boolean) => void
  onQueue: () => void
}

interface StatusLook {
  label: string
  dot: string
}

function lookOf(status: 'checking' | 'demo' | 'online' | 'offline'): StatusLook {
  switch (status) {
    case 'checking':
      return { label: 'Verificando conexão', dot: 'bg-sage' }
    case 'demo':
      return { label: 'Modo demonstração', dot: 'bg-sage' }
    case 'online':
      return { label: 'Servidor local conectado', dot: 'bg-white' }
    case 'offline':
      return { label: 'Servidor local sem resposta: confira o make run', dot: 'bg-warning-tint' }
  }
}

export function StartScreen({ mode, connection, onBegin, onQueue }: StartScreenProps) {
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
    <section className="flex flex-1 flex-col bg-teal text-white">
      <div className="relative h-[clamp(14rem,36dvh,28rem)] flex-none">
        <img src="/photos/xsalada.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-x-[clamp(1rem,6vw,3rem)] top-[clamp(1rem,5vw,2.5rem)] flex items-center">
          <span className="flex h-14 items-center gap-3 rounded-full bg-white pr-5 pl-2 text-[clamp(1rem,2.5vw,1.375rem)] font-semibold text-ink">
            <StoreMark />
            Lanchonete Bem-te-vi
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-6 p-[clamp(1rem,6vw,3rem)]">
        <h1 className="text-[clamp(3rem,11vw,5.5rem)] leading-[0.95] font-bold tracking-[-0.04em]">
          Peça aqui. Pague aqui.
        </h1>
        <p className="max-w-[600px] text-[clamp(1.125rem,3.25vw,1.625rem)] leading-[1.35] text-on-teal">
          Monte o pedido, pague por aproximação ou Pix e retire no balcão.
        </p>
        <p className="mt-auto text-[32px] font-semibold">Onde você vai comer?</p>
        <div className="grid grid-cols-2 gap-6 max-sm:gap-3">
          <button
            type="button"
            onClick={() => onBegin(true)}
            className="flex h-40 flex-col items-start justify-between rounded-[32px] bg-white p-6 text-left text-[32px] font-semibold text-ink max-sm:text-[22px]"
          >
            <DineInIcon size={44} className="text-teal" />
            Comer aqui
          </button>
          <button
            type="button"
            onClick={() => onBegin(false)}
            className="flex h-40 flex-col items-start justify-between rounded-[32px] bg-white p-6 text-left text-[32px] font-semibold text-ink max-sm:text-[22px]"
          >
            <TakeAwayIcon size={44} className="text-teal" />
            Levar para viagem
          </button>
        </div>
        <button
          type="button"
          onClick={onQueue}
          className="min-h-16 self-start text-[22px] font-medium underline underline-offset-4"
        >
          A fila está grande? Peça pelo celular
        </button>
        <div className="flex items-center justify-between gap-4 text-on-teal">
          <p role="status" className="flex items-center gap-3 text-[18px] font-medium">
            <span aria-hidden="true" className={`size-3 rounded-full ${look.dot}`} />
            {look.label}
          </p>
          <p className="flex items-center gap-2 text-[18px] font-medium">
            <img src="/topa-mark.png" alt="" className="h-6 w-auto brightness-0 invert" />
            por TOPA
          </p>
        </div>
      </div>
    </section>
  )
}
