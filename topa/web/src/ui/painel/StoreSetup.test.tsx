import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { StoreSetup } from './StoreSetup'

const base = {
  storeSlug: 'restaurante',
  storeName: 'Restaurante da Esquina',
  loaded: true,
  accepting: false,
  productCount: 0,
  availableCount: 0,
  onAddProduct: vi.fn(),
  onOrderingChanged: vi.fn(),
}

describe('first shift setup', () => {
  it('guides the owner from the first product to opening and sharing their own menu', async () => {
    const user = userEvent.setup()
    const onAddProduct = vi.fn()
    const setAcceptingOrders = vi.fn()
    render(
      <StoreSetup {...base} stores={{ listAll: vi.fn(), setAcceptingOrders }} onAddProduct={onAddProduct} />,
    )
    expect(screen.getByText('Comece pelo seu cardápio')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir loja' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Cadastrar primeiro produto' }))
    expect(onAddProduct).toHaveBeenCalledOnce()
    expect(screen.getByRole('link', { name: 'Ver cardápio' })).toHaveAttribute(
      'href',
      '/pedir?loja=restaurante',
    )
    expect(screen.getByRole('link', { name: 'Abrir o totem' })).toHaveAttribute(
      'href',
      '/totem?loja=restaurante',
    )
    expect(screen.getByLabelText('Link do cardápio')).toHaveValue(
      `${window.location.origin}/pedir?loja=restaurante`,
    )
  })

  it('opens a prepared store and updates the dashboard only after the server confirms', async () => {
    const setAcceptingOrders = vi.fn().mockResolvedValue(true)
    const onOrderingChanged = vi.fn()
    render(
      <StoreSetup
        {...base}
        productCount={1}
        availableCount={1}
        stores={{ listAll: vi.fn(), setAcceptingOrders }}
        onOrderingChanged={onOrderingChanged}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Abrir loja' }))
    expect(setAcceptingOrders).toHaveBeenCalledWith('restaurante', true)
    expect(onOrderingChanged).toHaveBeenCalledWith(true)
  })

  it('pauses ordering at the end of the shift and explains what to do with remaining orders', async () => {
    const setAcceptingOrders = vi.fn().mockResolvedValue(false)
    render(
      <StoreSetup
        {...base}
        accepting
        productCount={1}
        availableCount={1}
        stores={{ listAll: vi.fn(), setAcceptingOrders }}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Pausar pedidos' }))
    expect(setAcceptingOrders).toHaveBeenCalledWith('restaurante', false)
    expect(screen.getByText(/Ao encerrar o dia, pause os pedidos/)).toBeInTheDocument()
  })

  it.each([new Error('Sem conexão. Tente de novo.'), 'network failed'])(
    'preserves the previous state when opening fails: %s',
    async (error) => {
      const onOrderingChanged = vi.fn()
      render(
        <StoreSetup
          {...base}
          productCount={1}
          availableCount={1}
          onOrderingChanged={onOrderingChanged}
          stores={{ listAll: vi.fn(), setAcceptingOrders: vi.fn().mockRejectedValue(error) }}
        />,
      )
      await userEvent.click(screen.getByRole('button', { name: 'Abrir loja' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(/Tente de novo/)
      expect(onOrderingChanged).not.toHaveBeenCalled()
    },
  )

  it('waits for the actual store state before allowing changes', () => {
    render(
      <StoreSetup
        {...base}
        storeName={null}
        loaded={false}
        stores={{ listAll: vi.fn(), setAcceptingOrders: vi.fn() }}
      />,
    )
    expect(screen.getByRole('button', { name: 'Abrir loja' })).toBeDisabled()
    expect(screen.getByText('Carregando sua loja...')).toBeInTheDocument()
  })
})
