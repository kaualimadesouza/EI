import { useEffect, useState } from 'react'

import { formatBRL, type Product } from '../../domain/menu'
import { parseVoiceOrder } from '../../domain/voice'
import type { VoiceRecognitionPort } from '../../ports/voice'
import { AlertIcon, CheckIcon, CloseIcon, MicIcon } from '../icons'
import { PRIMARY_ACTION, SECONDARY_ACTION, Sheet } from './parts'

interface VoiceOrderModalProps {
  products: readonly Product[]
  voiceAdapter: VoiceRecognitionPort
  onAddItems: (items: readonly { productId: string; quantity: number }[]) => void
  onClose: () => void
}

export function VoiceOrderModal({
  products,
  voiceAdapter,
  onAddItems,
  onClose,
}: VoiceOrderModalProps) {
  const [transcript, setTranscript] = useState('')
  const [isListening, setIsListening] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isListening) return

    const stop = voiceAdapter.startListening(
      (text) => {
        setTranscript(text)
        setError(null)
      },
      (err) => {
        setError(err)
        setIsListening(false)
      },
    )

    return () => stop()
  }, [voiceAdapter, isListening])

  const parsed = parseVoiceOrder(transcript, products)
  const availableItems = parsed.matchedItems.filter((item) => item.available)

  const handleConfirm = () => {
    onAddItems(availableItems.map((item) => ({ productId: item.productId, quantity: item.quantity })))
    onClose()
  }

  const handleRetry = () => {
    setTranscript('')
    setError(null)
    setIsListening(true)
  }

  return (
    <Sheet title="Fazer pedido por voz">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-[14px] bg-teal/15 text-teal transition-transform motion-safe:animate-pulse">
            <MicIcon size={28} />
          </div>
          <div>
            <h2 className="text-[22px] font-bold">Pedido por voz</h2>
            <p className="text-[14px] text-muted">Fale o que deseja pedir com as quantidades</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="flex size-11 cursor-pointer items-center justify-center rounded-[12px] border border-line text-muted transition-all duration-150 hover:text-ink motion-safe:active:scale-95"
        >
          <CloseIcon size={22} />
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-[16px] border border-warning/30 bg-warning-tint p-4 text-warning">
          <AlertIcon size={24} className="text-warning" />
          <div className="flex-1 text-[15px]">
            <p className="font-semibold">Erro no microfone</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-[16px] border border-line bg-ground-2 p-4">
            <span className="flex size-4 rounded-full bg-teal motion-safe:animate-pulse" />
            <p className="text-[15px] font-medium text-slate">
              Ouvindo... Fale com naturalidade
            </p>
          </div>

          <div className="min-h-[72px] rounded-[16px] border border-line bg-white p-4">
            <p className="text-[13px] font-medium text-muted">Transcrição ao vivo:</p>
            <p className="mt-1 text-[17px] font-semibold text-ink">
              {transcript || 'Aguardando sua voz... (Ex: "dois mistos quentes e uma coca")'}
            </p>
          </div>

          {parsed.matchedItems.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[14px] font-bold text-ink">Itens identificados no cardápio:</p>
              <ul className="flex flex-col divide-y divide-line rounded-[16px] border border-line bg-white">
                {parsed.matchedItems.map((item) => (
                  <li
                    key={item.productId}
                    className="flex items-center justify-between p-3.5 motion-safe:animate-fade-in"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-7 items-center justify-center rounded-[8px] bg-teal/15 text-[14px] font-bold text-teal">
                        {item.quantity}x
                      </span>
                      <div>
                        <p className="text-[15px] font-semibold text-ink">{item.name}</p>
                        {!item.available && (
                          <p className="text-[12px] font-medium text-warning">
                            Esgotado temporariamente
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold text-ink">
                        {formatBRL(item.priceCents * item.quantity)}
                      </span>
                      {item.available && <CheckIcon size={18} className="text-teal" />}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {parsed.unmatchedItems.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-[14px] border border-warning/30 bg-warning-tint p-3 text-[13px] text-warning">
              <p className="font-semibold">Itens não reconhecidos no cardápio desta loja:</p>
              <ul className="list-disc pl-5">
                {parsed.unmatchedItems.map((unmatched, idx) => (
                  <li key={idx}>"{unmatched.spokenPhrase}"</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pt-2 max-sm:grid-cols-1">
        <button
          type="button"
          onClick={handleRetry}
          className={`${SECONDARY_ACTION} h-14 text-[16px] text-ink`}
        >
          Tentar novamente
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={availableItems.length === 0}
          className={`${PRIMARY_ACTION} h-14 text-[16px] disabled:opacity-40`}
        >
          {availableItems.length > 0
            ? `Adicionar (${formatBRL(parsed.totalCents)})`
            : 'Adicionar ao pedido'}
        </button>
      </div>
    </Sheet>
  )
}
