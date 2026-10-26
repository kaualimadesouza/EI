import { useEffect, useState } from 'react'

import type { Connection, ConnectionPort } from '../ports/connection'

interface StartScreenProps {
  connection: ConnectionPort
}

interface StatusLook {
  label: string
  dot: string
}

function lookOf(status: Connection | null): StatusLook {
  if (status === null) return { label: 'Verificando conexão', dot: 'bg-sage' }
  if (status.mode === 'demo') return { label: 'Modo demonstração', dot: 'bg-sage' }
  if (status.reachable) return { label: 'Servidor local conectado', dot: 'bg-white' }
  return { label: 'Servidor local sem resposta', dot: 'bg-warning' }
}

export function StartScreen({ connection }: StartScreenProps) {
  const [status, setStatus] = useState<Connection | null>(null)

  useEffect(() => {
    let current = true
    void connection.check().then((answer) => {
      if (current) setStatus(answer)
    })
    return () => {
      current = false
    }
  }, [connection])

  const look = lookOf(status)

  return (
    <section className="flex flex-1 flex-col bg-teal text-white">
      <div className="relative h-[clamp(16rem,40.6dvh,32.5rem)] flex-none">
        <img src="/photos/xsalada.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-x-[clamp(1rem,6vw,3rem)] top-[clamp(1rem,5vw,2.5rem)] flex items-center">
          <span className="flex h-14 items-center gap-3 rounded-full bg-white pr-5 pl-2 text-[clamp(1rem,2.5vw,1.25rem)] font-semibold text-ink">
            <svg width="40" height="40" viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="24" cy="24" r="24" fill="#000000" />
              <path d="M1 27c0 12.7 10.3 23 23 23s23-10.3 23-23z" fill="#1A4D49" />
              <path d="M9 19c6-6 24-6 30 0" stroke="#FFFFFF" strokeWidth="3.5" fill="none" strokeLinecap="round" />
              <circle cx="31" cy="22" r="2.5" fill="#FFFFFF" />
            </svg>
            Lanchonete Bem-te-vi
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-6 p-[clamp(1.5rem,6vw,3rem)]">
        <h1 className="text-[clamp(3rem,11vw,5.5rem)] leading-[0.95] font-bold tracking-[-0.04em]">
          Peça aqui. Pague aqui.
        </h1>
        <p className="max-w-[600px] text-[clamp(1.125rem,3.25vw,1.625rem)] leading-[1.35] text-on-teal">
          Monte o pedido, pague por aproximação ou Pix e retire no balcão.
        </p>
        <div className="mt-auto flex items-center justify-between gap-4 text-on-teal">
          <p role="status" className="flex items-center gap-3 text-lg font-medium">
            <span aria-hidden="true" className={`size-3 rounded-full ${look.dot}`} />
            {look.label}
          </p>
          <p className="flex items-center gap-2 text-sm font-medium">
            <img src="/topa-mark.png" alt="" className="h-6 w-auto brightness-0 invert" />
            por TOPA
          </p>
        </div>
      </div>
    </section>
  )
}
