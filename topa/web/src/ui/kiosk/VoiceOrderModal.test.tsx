import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Product } from '../../domain/menu'
import type { VoiceRecognitionPort } from '../../ports/voice'
import { VoiceOrderModal } from './VoiceOrderModal'

const PRODUCTS: Product[] = [
  {
    id: 'misto',
    name: 'Misto Quente',
    description: 'Pão de forma tostado.',
    category: 'lanches',
    priceCents: 1200,
    available: true,
  },
  {
    id: 'suco',
    name: 'Suco de Laranja',
    description: 'Copo 300ml.',
    category: 'bebidas',
    priceCents: 800,
    available: true,
  },
  {
    id: 'shake',
    name: 'Milkshake',
    description: 'Copo 400ml.',
    category: 'bebidas',
    priceCents: 1600,
    available: false,
  },
]

function makeVoiceAdapter(override?: Partial<VoiceRecognitionPort>): {
  adapter: VoiceRecognitionPort
  emitTranscript: (text: string, isFinal?: boolean) => void
  emitError: (err: string) => void
  stopFn: ReturnType<typeof vi.fn>
} {
  let transcriptCb: (text: string, isFinal: boolean) => void = () => {}
  let errorCb: (err: string) => void = () => {}
  const stopFn = vi.fn()

  const adapter: VoiceRecognitionPort = {
    isSupported: () => true,
    startListening: (onTranscript, onError) => {
      transcriptCb = onTranscript
      errorCb = onError
      return stopFn
    },
    ...override,
  }

  return {
    adapter,
    emitTranscript: (t: string, f = true) => act(() => { transcriptCb(t, f) }),
    emitError: (err: string) => act(() => { errorCb(err) }),
    stopFn,
  }
}

describe('VoiceOrderModal', () => {
  it('renders listening state and live transcript', async () => {
    const { adapter, emitTranscript, stopFn } = makeVoiceAdapter()
    const onAddItems = vi.fn()
    const onClose = vi.fn()

    const { unmount } = render(
      <VoiceOrderModal
        products={PRODUCTS}
        voiceAdapter={adapter}
        onAddItems={onAddItems}
        onClose={onClose}
      />,
    )

    expect(screen.getByText('Pedido por voz')).toBeInTheDocument()
    expect(screen.getByText('Ouvindo... Fale com naturalidade')).toBeInTheDocument()

    emitTranscript('dois mistos quentes e uma pizza')

    expect(screen.getByText('dois mistos quentes e uma pizza')).toBeInTheDocument()
    expect(screen.getByText('Misto Quente')).toBeInTheDocument()
    expect(screen.getByText('2x')).toBeInTheDocument()
    expect(screen.getByText('"uma pizza"')).toBeInTheDocument()

    unmount()
    expect(stopFn).toHaveBeenCalled()
  })

  it('confirms and adds only available matched items to order', async () => {
    const user = userEvent.setup()
    const { adapter, emitTranscript } = makeVoiceAdapter()
    const onAddItems = vi.fn()
    const onClose = vi.fn()

    render(
      <VoiceOrderModal
        products={PRODUCTS}
        voiceAdapter={adapter}
        onAddItems={onAddItems}
        onClose={onClose}
      />,
    )

    emitTranscript('um misto quente e um milkshake')

    expect(screen.getByText('Esgotado temporariamente')).toBeInTheDocument()

    const confirmButton = screen.getByRole('button', { name: /^Adicionar/i })
    await user.click(confirmButton)

    expect(onAddItems).toHaveBeenCalledWith([{ productId: 'misto', quantity: 1 }])
    expect(onClose).toHaveBeenCalled()
  })

  it('handles microphone errors and allows retry', async () => {
    const user = userEvent.setup()
    const { adapter, emitError, emitTranscript } = makeVoiceAdapter()
    const onClose = vi.fn()

    render(
      <VoiceOrderModal
        products={PRODUCTS}
        voiceAdapter={adapter}
        onAddItems={vi.fn()}
        onClose={onClose}
      />,
    )

    emitError('Microfone bloqueado')
    expect(screen.getByText('Erro no microfone')).toBeInTheDocument()
    expect(screen.getByText('Microfone bloqueado')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(screen.queryByText('Erro no microfone')).not.toBeInTheDocument()

    emitTranscript('suco de laranja')
    expect(screen.getByText('Suco de Laranja')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('disables confirmation button when zero available items', async () => {
    const { adapter, emitTranscript } = makeVoiceAdapter()
    const onAddItems = vi.fn()
    const onClose = vi.fn()

    render(
      <VoiceOrderModal
        products={PRODUCTS}
        voiceAdapter={adapter}
        onAddItems={onAddItems}
        onClose={onClose}
      />,
    )

    emitTranscript('um milkshake')
    expect(screen.getByText('Esgotado temporariamente')).toBeInTheDocument()

    const confirmBtn = screen.getByRole('button', { name: 'Adicionar ao pedido' })
    expect(confirmBtn).toBeDisabled()
  })
})
