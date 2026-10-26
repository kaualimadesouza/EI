import { useEffect, useRef, useState } from 'react'

import { type StoreRef, storeFromUrl } from '../../domain/store'
import type { NfcPort, ScanFailure } from '../../ports/nfc'
import { PhoneScreen, PRIMARY_ACTION, SECONDARY_ACTION } from './PhoneScreen'

interface PhoneHomeProps {
  nfc: NfcPort
  onStore: (store: StoreRef) => void
}

interface Problem {
  title: string
  hint: string
  retry: boolean
}

const PROBLEMS: Record<ScanFailure['kind'], Problem> = {
  'no-nfc': {
    title: 'Este celular não tem NFC.',
    hint: 'Leia o QR Code do totem com a câmera para abrir o cardápio.',
    retry: false,
  },
  'nfc-off': {
    title: 'O NFC está desligado.',
    hint: 'Ative o NFC nas configurações do celular e toque em Tentar de novo.',
    retry: true,
  },
  'no-url': {
    title: 'Adesivo não reconhecido.',
    hint: 'Use o adesivo TOPA que fica ao lado da tela do totem.',
    retry: true,
  },
  'nothing-read': {
    title: 'Não foi possível ler o adesivo.',
    hint: 'Mantenha o celular encostado no adesivo até a leitura terminar.',
    retry: true,
  },
}

function ContactlessGlyph({ active }: { active: boolean }) {
  return (
    <svg width="120" height="120" viewBox="0 0 96 96" fill="none" strokeWidth="4" strokeLinecap="round" aria-hidden="true">
      <rect x="20" y="14" width="34" height="62" rx="7" className="stroke-white" />
      <path d="M32 22h10" className="stroke-white" />
      <g className={`stroke-sage ${active ? 'motion-safe:animate-pulse' : ''}`}>
        <path d="M64.5 35.5a12 12 0 0 1 0 17" />
        <path d="M70.1 29.9a20 20 0 0 1 0 28.2" />
        <path d="M75.8 24.2a28 28 0 0 1 0 39.6" />
      </g>
    </svg>
  )
}

function WarningGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="flex-none stroke-warning" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7v6M12 17h.01" />
    </svg>
  )
}

/** The phone app's start: read the NFC sticker next to a busy totem and open that store here. */
export function PhoneHome({ nfc, onStore }: PhoneHomeProps) {
  const [phase, setPhase] = useState<'idle' | 'scanning' | ScanFailure['kind']>('idle')
  // always holds the latest scan's controller, so cancel and unmount can abort it
  const scan = useRef(new AbortController())

  useEffect(() => () => scan.current.abort(), [])

  async function startScan() {
    const controller = new AbortController()
    scan.current = controller
    setPhase('scanning')
    const result = await nfc.scan(controller.signal)
    if (controller.signal.aborted) return
    if (result.kind !== 'url') {
      setPhase(result.kind)
      return
    }
    const store = storeFromUrl(result.url)
    if (!store) {
      setPhase('no-url')
      return
    }
    setPhase('idle')
    onStore(store)
  }

  function cancel() {
    scan.current.abort()
    setPhase('idle')
  }

  const problem = phase === 'idle' || phase === 'scanning' ? null : PROBLEMS[phase]

  return (
    <PhoneScreen
      hero={
        <>
          <ContactlessGlyph active={phase === 'scanning'} />
          <h1 className="text-[clamp(2.75rem,13vw,4rem)] leading-[0.95] font-bold tracking-[-0.04em]">
            Peça pelo celular.
          </h1>
          <p className="max-w-[30ch] text-lg leading-[1.4] text-on-teal">
            Totem com fila? Aproxime o celular do adesivo TOPA e o cardápio da loja abre aqui.
          </p>
        </>
      }
    >
      {phase === 'scanning' && (
        <>
          <p role="status" className="text-xl leading-snug font-semibold">
            Encoste o celular no adesivo TOPA ao lado da tela do totem.
          </p>
          <button type="button" onClick={cancel} className={SECONDARY_ACTION}>
            Cancelar
          </button>
        </>
      )}
      {problem && (
        <div role="alert" className="flex gap-3 rounded-2xl bg-ground-2 p-4">
          <WarningGlyph />
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold text-warning">{problem.title}</p>
            <p className="leading-snug text-muted">{problem.hint}</p>
          </div>
        </div>
      )}
      {phase === 'idle' && (
        <button type="button" onClick={startScan} className={PRIMARY_ACTION}>
          Aproximar do totem
        </button>
      )}
      {problem?.retry && (
        <button type="button" onClick={startScan} className={PRIMARY_ACTION}>
          Tentar de novo
        </button>
      )}
    </PhoneScreen>
  )
}
