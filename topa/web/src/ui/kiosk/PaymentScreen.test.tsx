import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PaymentPort, PixChargeInfo } from '../../ports/payment'
import { PaymentScreen } from './PaymentScreen'

describe('PaymentScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders card payment instructions on totem by default', () => {
    render(
      <PaymentScreen
        totalCents={2990}
        method="card"
        payment="choosing"
        error={null}
        surface="totem"
        onMethod={vi.fn()}
        onApprove={vi.fn()}
        onDecline={vi.fn()}
        onBackToBag={vi.fn()}
      />,
    )

    expect(screen.getByText('Como você quer pagar?')).toBeInTheDocument()
    expect(screen.getByText('R$ 29,90')).toBeInTheDocument()
    expect(screen.getByText('Aproxime o cartão ou o celular da parte de trás do totem.')).toBeInTheDocument()
  })

  it('renders pix payment instructions with demo fallback when no port provided', () => {
    render(
      <PaymentScreen
        totalCents={1500}
        method="pix"
        payment="choosing"
        error={null}
        surface="phone"
        onMethod={vi.fn()}
        onApprove={vi.fn()}
        onDecline={vi.fn()}
        onBackToBag={vi.fn()}
      />,
    )

    expect(screen.getByText('Pague com Pix')).toBeInTheDocument()
    expect(screen.getByText('R$ 15,00')).toBeInTheDocument()
    expect(screen.getByText('Copie o código Pix e pague no app do seu banco.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copiar código Pix' })).toBeInTheDocument()
  })

  it('copies pix code to clipboard and shows feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText },
    })

    render(
      <PaymentScreen
        totalCents={1500}
        method="pix"
        payment="choosing"
        error={null}
        surface="phone"
        onMethod={vi.fn()}
        onApprove={vi.fn()}
        onDecline={vi.fn()}
        onBackToBag={vi.fn()}
      />,
    )

    const copyBtn = screen.getByRole('button', { name: 'Copiar código Pix' })
    fireEvent.click(copyBtn)

    await act(async () => {
      await Promise.resolve()
    })

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('TOPA-PIX-DEMO-1500'))
    expect(screen.getByText('Código copiado')).toBeInTheDocument()
  })

  it('displays fallback text when clipboard write fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard denied'))
    Object.assign(navigator, {
      clipboard: { writeText },
    })

    render(
      <PaymentScreen
        totalCents={1500}
        method="pix"
        payment="choosing"
        error={null}
        surface="phone"
        onMethod={vi.fn()}
        onApprove={vi.fn()}
        onDecline={vi.fn()}
        onBackToBag={vi.fn()}
      />,
    )

    const copyBtn = screen.getByRole('button', { name: 'Copiar código Pix' })
    fireEvent.click(copyBtn)

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText(/TOPA-PIX-DEMO-1500/)).toBeInTheDocument()
  })

  it('creates pix charge via paymentPort and polls for completion', async () => {
    const onApprove = vi.fn()
    const charge: PixChargeInfo = {
      id: 'pix_charge_live_99',
      orderId: 'order_test_99',
      amountCents: 3500,
      status: 'PENDING',
      brCode: '00020126580014br.gov.bcb.pix...',
      brCodeBase64: 'data:image/png;base64,sampleqr',
      qrCodeUrl: null,
      expiresAt: null,
    }

    const fakePort: PaymentPort = {
      createPixCharge: vi.fn().mockResolvedValue(charge),
      getPaymentStatus: vi
        .fn()
        .mockResolvedValueOnce({ ...charge, status: 'PENDING' })
        .mockResolvedValueOnce({ ...charge, status: 'PAID' }),
    }

    render(
      <PaymentScreen
        totalCents={3500}
        method="pix"
        payment="choosing"
        error={null}
        surface="totem"
        paymentPort={fakePort}
        orderId="order_test_99"
        onMethod={vi.fn()}
        onApprove={onApprove}
        onDecline={vi.fn()}
        onBackToBag={vi.fn()}
      />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(fakePort.createPixCharge).toHaveBeenCalledWith('order_test_99', 3500, 'Pedido TOPA')
    expect(screen.getByAltText('QR Code Pix')).toBeInTheDocument()

    // Advance 2 seconds for first poll (returns PENDING)
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(fakePort.getPaymentStatus).toHaveBeenCalledTimes(1)
    expect(onApprove).not.toHaveBeenCalled()

    // Advance another 2 seconds for second poll (returns PAID)
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(fakePort.getPaymentStatus).toHaveBeenCalledTimes(2)
    expect(onApprove).toHaveBeenCalled()
  })

  it('renders processing state', () => {
    render(
      <PaymentScreen
        totalCents={1000}
        method="card"
        payment="processing"
        error={null}
        onMethod={vi.fn()}
        onApprove={vi.fn()}
        onDecline={vi.fn()}
        onBackToBag={vi.fn()}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Processando o pagamento...')
  })

  it('renders declined state on totem and phone', () => {
    const onMethod = vi.fn()
    const { rerender } = render(
      <PaymentScreen
        totalCents={1000}
        method="card"
        payment="declined"
        error={null}
        surface="totem"
        onMethod={onMethod}
        onApprove={vi.fn()}
        onDecline={vi.fn()}
        onBackToBag={vi.fn()}
      />,
    )

    expect(screen.getByText('Pagamento não aprovado. Tente de novo ou pague com Pix.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pagar com Pix' }))
    expect(onMethod).toHaveBeenCalledWith('pix')

    rerender(
      <PaymentScreen
        totalCents={1000}
        method="pix"
        payment="declined"
        error={null}
        surface="phone"
        onMethod={onMethod}
        onApprove={vi.fn()}
        onDecline={vi.fn()}
        onBackToBag={vi.fn()}
      />,
    )
    expect(screen.getByText('Pagamento não confirmado. Tente de novo.')).toBeInTheDocument()
  })

  it('renders failed state with back to bag button', () => {
    const onBackToBag = vi.fn()
    render(
      <PaymentScreen
        totalCents={1000}
        method="card"
        payment="failed"
        error="Erro de conexão com o terminal"
        onMethod={vi.fn()}
        onApprove={vi.fn()}
        onDecline={vi.fn()}
        onBackToBag={onBackToBag}
      />,
    )

    expect(screen.getByText('Erro de conexão com o terminal')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao pedido' }))
    expect(onBackToBag).toHaveBeenCalled()
  })

  it('triggers onMethod when clicking method tiles on totem', () => {
    const onMethod = vi.fn()
    render(
      <PaymentScreen
        totalCents={2000}
        method="card"
        payment="choosing"
        error={null}
        surface="totem"
        onMethod={onMethod}
        onApprove={vi.fn()}
        onDecline={vi.fn()}
        onBackToBag={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Pix/ }))
    expect(onMethod).toHaveBeenCalledWith('pix')
  })

  it('simulates approval and decline via demo buttons', () => {
    const onApprove = vi.fn()
    const onDecline = vi.fn()
    render(
      <PaymentScreen
        totalCents={2000}
        method="card"
        payment="choosing"
        error={null}
        isDemo={true}
        onMethod={vi.fn()}
        onApprove={onApprove}
        onDecline={onDecline}
        onBackToBag={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Simular aprovação (demo)' }))
    expect(onApprove).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Simular recusa (demo)' }))
    expect(onDecline).toHaveBeenCalled()
  })

  it('handles expired pix code with generate new code button', () => {
    render(
      <PaymentScreen
        totalCents={1500}
        method="pix"
        payment="choosing"
        error={null}
        surface="totem"
        onMethod={vi.fn()}
        onApprove={vi.fn()}
        onDecline={vi.fn()}
        onBackToBag={vi.fn()}
      />,
    )

    // Advance 300 seconds to trigger countdown expiration
    act(() => {
      vi.advanceTimersByTime(300000)
    })

    expect(screen.getByText('O código Pix expirou.')).toBeInTheDocument()
    const newCodeBtn = screen.getByRole('button', { name: 'Gerar novo código' })
    fireEvent.click(newCodeBtn)
    expect(screen.queryByText('O código Pix expirou.')).not.toBeInTheDocument()
  })

  it('handles missing navigator.clipboard gracefully', () => {
    const originalClipboard = navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })

    try {
      render(
        <PaymentScreen
          totalCents={1500}
          method="pix"
          payment="choosing"
          error={null}
          surface="phone"
          onMethod={vi.fn()}
          onApprove={vi.fn()}
          onDecline={vi.fn()}
          onBackToBag={vi.fn()}
        />,
      )

      const copyBtn = screen.getByRole('button', { name: 'Copiar código Pix' })
      fireEvent.click(copyBtn)

      expect(screen.getByText(/TOPA-PIX-DEMO-1500/)).toBeInTheDocument()
    } finally {
      Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true })
    }
  })

  it('handles synchronous exception during clipboard writeText', () => {
    const originalClipboard = navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: () => {
          throw new Error('sync clipboard throw')
        },
      },
      configurable: true,
    })

    try {
      render(
        <PaymentScreen
          totalCents={1500}
          method="pix"
          payment="choosing"
          error={null}
          surface="phone"
          onMethod={vi.fn()}
          onApprove={vi.fn()}
          onDecline={vi.fn()}
          onBackToBag={vi.fn()}
        />,
      )

      const copyBtn = screen.getByRole('button', { name: 'Copiar código Pix' })
      fireEvent.click(copyBtn)

      expect(screen.getByText(/TOPA-PIX-DEMO-1500/)).toBeInTheDocument()
    } finally {
      Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true })
    }
  })

  it('handles createPixCharge rejection and component unmount', async () => {
    let rejectPromise: ((err: Error) => void) | null = null
    const slowPort: PaymentPort = {
      createPixCharge: vi.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            rejectPromise = reject
          }),
      ),
      getPaymentStatus: vi.fn(),
    }

    const { unmount } = render(
      <PaymentScreen
        totalCents={1500}
        method="pix"
        payment="choosing"
        error={null}
        surface="totem"
        paymentPort={slowPort}
        onMethod={vi.fn()}
        onApprove={vi.fn()}
        onDecline={vi.fn()}
        onBackToBag={vi.fn()}
      />,
    )

    unmount()
    if (rejectPromise) {
      await act(async () => {
        rejectPromise!(new Error('failed after unmount'))
      })
    }
  })

  it('ignores successful charge creation after unmount', async () => {
    let resolvePromise: ((c: PixChargeInfo) => void) | null = null
    const slowPort: PaymentPort = {
      createPixCharge: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve
          }),
      ),
      getPaymentStatus: vi.fn(),
    }

    const { unmount } = render(
      <PaymentScreen
        totalCents={1500}
        method="pix"
        payment="choosing"
        error={null}
        surface="totem"
        paymentPort={slowPort}
        onMethod={vi.fn()}
        onApprove={vi.fn()}
        onDecline={vi.fn()}
        onBackToBag={vi.fn()}
      />,
    )

    unmount()
    if (resolvePromise) {
      await act(async () => {
        resolvePromise!({
          id: 'pix_charge_late',
          orderId: 'late',
          amountCents: 1500,
          status: 'PENDING',
          brCode: '000201...',
        })
      })
    }
  })

  it('handles getPaymentStatus failure during polling', async () => {
    const charge: PixChargeInfo = {
      id: 'pix_charge_fail_polling',
      orderId: 'order_test_fail',
      amountCents: 2000,
      status: 'PENDING',
      brCode: '000201...',
      brCodeBase64: null,
      qrCodeUrl: null,
      expiresAt: null,
    }

    const fakePort: PaymentPort = {
      createPixCharge: vi.fn().mockResolvedValue(charge),
      getPaymentStatus: vi.fn().mockRejectedValue(new Error('temporary network drop')),
    }

    render(
      <PaymentScreen
        totalCents={2000}
        method="pix"
        payment="choosing"
        error={null}
        surface="totem"
        paymentPort={fakePort}
        orderId="order_test_fail"
        onMethod={vi.fn()}
        onApprove={vi.fn()}
        onDecline={vi.fn()}
        onBackToBag={vi.fn()}
      />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    // Advance 2 seconds - polling rejects but does not crash
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(fakePort.getPaymentStatus).toHaveBeenCalled()
  })
})
