import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LocalPrinterAdapter } from '../../adapters/local/local-printer'
import type { OrderSummary } from '../../domain/order'
import { TicketPreviewModal } from './TicketPreviewModal'

describe('TicketPreviewModal', () => {
  const sampleOrder: OrderSummary = {
    id: 'ord-123',
    number: 77,
    status: 'preparing',
    dineIn: true,
    paymentMethod: 'card',
    totalCents: 2400,
    createdAt: '2026-10-30T12:00:00Z',
    items: [{ productId: 'misto', name: 'Misto Quente', quantity: 2, unitPriceCents: 1200 }],
  }

  it('renders nothing when not open or order is null', () => {
    const printer = new LocalPrinterAdapter()
    const { container: c1 } = render(
      <TicketPreviewModal order={sampleOrder} storeName="Lanchonete" printer={printer} isOpen={false} onClose={() => {}} />
    )
    expect(c1).toBeEmptyDOMElement()

    const { container: c2 } = render(
      <TicketPreviewModal order={null} storeName="Lanchonete" printer={printer} isOpen={true} onClose={() => {}} />
    )
    expect(c2).toBeEmptyDOMElement()
  })

  it('renders kitchen ticket by default, prints, and switches to fiscal cupom', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const printer = new LocalPrinterAdapter()
    const onClose = vi.fn()

    render(
      <TicketPreviewModal
        order={sampleOrder}
        storeName="Lanchonete Bem-te-vi"
        printer={printer}
        isOpen={true}
        onClose={onClose}
      />
    )

    expect(screen.getByRole('dialog', { name: 'Visualização de impressão ESC-POS' })).toBeInTheDocument()
    expect(screen.getByText('PEDIDO #77')).toBeInTheDocument()
    expect(screen.getByText('COZINHA: LANCHONETE BEM-TE-VI')).toBeInTheDocument()

    // Print ticket
    await user.click(screen.getByRole('button', { name: 'Imprimir' }))
    expect(printer.spool).toHaveLength(1)
    expect(screen.getByText('Impresso com sucesso!')).toBeInTheDocument()

    // Timer expires and restores emulador label
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByText('Emulador ESC/POS')).toBeInTheDocument()

    // Switch to Cupom NFC-e
    await user.click(screen.getByRole('button', { name: 'Cupom NFC-e' }))
    expect(screen.getByText('DOCUMENTO AUXILIAR DA NFC-e')).toBeInTheDocument()
    expect(screen.getByText('CHAVE DE ACESSO')).toBeInTheDocument()

    // Switch back to Kitchen ticket
    await user.click(screen.getByRole('button', { name: 'Comanda cozinha' }))
    expect(screen.getByText('PEDIDO #77')).toBeInTheDocument()

    // Close modal via top button
    await user.click(screen.getByRole('button', { name: 'Fechar modal' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    // Close modal via footer button
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalledTimes(2)

    vi.useRealTimers()
  })
})
