import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { OrderSummary } from '../../domain/order'
import type { OrdersPort } from '../../ports/orders'
import type { StoresPort } from '../../ports/stores'
import { StoreSelectorScreen } from './StoreSelectorScreen'

describe('StoreSelectorScreen', () => {
  const customer = { id: 'c1', name: 'Larissa Lima', email: 'larissa@email.com' }

  const sampleStores = [
    { slug: 'brasa-burgers', name: 'Brasa Burgers' },
    { slug: 'bella-nonna', name: 'Cantina Bella Nonna' },
    { slug: 'acai-bowls', name: 'Açaí & Bowls Universitário' },
    { slug: 'lanchonete-bem-te-vi', name: 'Lanchonete Bem-te-vi' },
    { slug: 'custom-cafe', name: 'Café do Campus' },
  ]

  const sampleOrders: OrderSummary[] = [
    {
      id: 'o-1',
      storeSlug: 'brasa-burgers',
      number: 12,
      status: 'preparing',
      dineIn: false,
      paymentMethod: 'pix',
      totalCents: 3500,
      createdAt: '2026-10-29T14:30:00Z',
      items: [{ productId: 'b1', name: 'Cheeseburger Duplo', quantity: 1, unitPriceCents: 3500 }],
    },
    {
      id: 'o-2',
      storeSlug: 'bella-nonna',
      number: 5,
      status: 'ready',
      dineIn: true,
      paymentMethod: 'card',
      totalCents: 4200,
      createdAt: '2026-10-29T13:00:00Z',
      items: [{ productId: 'p1', name: 'Lasanha Bolonhesa', quantity: 1, unitPriceCents: 4200 }],
    },
    {
      id: 'o-3',
      storeSlug: 'custom-cafe',
      number: 3,
      status: 'delivered',
      dineIn: false,
      paymentMethod: 'pix',
      totalCents: 1200,
      createdAt: 'invalid-date',
      items: [{ productId: 'c1', name: 'Café Espresso', quantity: 2, unitPriceCents: 600 }],
    },
    {
      id: 'o-4',
      storeSlug: 'unknown-store',
      number: 1,
      status: 'received',
      dineIn: true,
      paymentMethod: 'card',
      totalCents: 1500,
      createdAt: '2026-10-29T11:00:00Z',
      items: [{ productId: 'x1', name: 'Item Teste', quantity: 1, unitPriceCents: 1500 }],
    },
    {
      id: 'o-5',
      number: 8,
      status: 'received',
      dineIn: false,
      paymentMethod: 'pix',
      totalCents: 2000,
      createdAt: '2026-10-29T10:00:00Z',
      items: [{ productId: 'u1', name: 'Combo', quantity: 1, unitPriceCents: 2000 }],
    },
  ]

  function createPorts(overrides?: { stores?: Partial<StoresPort>; orders?: Partial<OrdersPort> }) {
    const stores: StoresPort = {
      listAll: vi.fn().mockResolvedValue(sampleStores),
      ...overrides?.stores,
    }
    const orders: OrdersPort = {
      place: vi.fn(),
      list: vi.fn(),
      statusOf: vi.fn(),
      setStatus: vi.fn(),
      listCustomerOrders: vi.fn().mockResolvedValue(sampleOrders),
      ...overrides?.orders,
    }
    return { stores, orders }
  }

  it('renders greeting and lists restaurants from stores port', async () => {
    const user = userEvent.setup()
    const onSelectStore = vi.fn()
    const onLogout = vi.fn()
    const { stores, orders } = createPorts()

    render(
      <StoreSelectorScreen
        stores={stores}
        orders={orders}
        customer={customer}
        onSelectStore={onSelectStore}
        onLogout={onLogout}
      />,
    )

    expect(screen.getByText('Olá, Larissa Lima')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Brasa Burgers' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cantina Bella Nonna' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Café do Campus' })).toBeInTheDocument()

    // Click on Brasa Burgers
    await user.click(screen.getByRole('button', { name: 'Pedir em Brasa Burgers' }))
    expect(onSelectStore).toHaveBeenCalledWith('brasa-burgers')

    // Click on logout button
    await user.click(screen.getByRole('button', { name: 'Sair da conta' }))
    expect(onLogout).toHaveBeenCalled()
  })

  it('displays error message and allows retrying when loading stores fails', async () => {
    const user = userEvent.setup()
    const { stores, orders } = createPorts({
      stores: {
        listAll: vi
          .fn()
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce([{ slug: 'brasa-burgers', name: 'Brasa Burgers' }]),
      },
    })

    render(
      <StoreSelectorScreen
        stores={stores}
        orders={orders}
        customer={customer}
        onSelectStore={vi.fn()}
        onLogout={vi.fn()}
      />,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar a lista de restaurantes.',
    )

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('heading', { name: 'Brasa Burgers' })).toBeInTheDocument()
  })

  it('switches to orders tab and displays customer order history with status and items', async () => {
    const user = userEvent.setup()
    const { stores, orders } = createPorts()

    render(
      <StoreSelectorScreen
        stores={stores}
        orders={orders}
        customer={customer}
        onSelectStore={vi.fn()}
        onLogout={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'Meus Pedidos' }))

    expect(await screen.findByRole('heading', { name: 'Meus Pedidos' })).toBeInTheDocument()
    expect(await screen.findByText('Pedido #012')).toBeInTheDocument()
    expect(screen.getByText('Pedido #005')).toBeInTheDocument()
    expect(screen.getByText('Pedido #003')).toBeInTheDocument()
    expect(screen.getByText('Pedido #001')).toBeInTheDocument()
    expect(screen.getByText('Pedido #008')).toBeInTheDocument()
    expect(screen.getByText('Restaurante')).toBeInTheDocument()

    expect(screen.getByText('Em preparo')).toBeInTheDocument()
    expect(screen.getByText('Pronto')).toBeInTheDocument()
    expect(screen.getByText('Entregue')).toBeInTheDocument()
    expect(screen.getAllByText('Recebido')).toHaveLength(2)

    expect(screen.getByText('Cheeseburger Duplo')).toBeInTheDocument()
    expect(screen.getByText('Lasanha Bolonhesa')).toBeInTheDocument()

    // Switch back to stores tab via tab button
    await user.click(screen.getByRole('tab', { name: 'Restaurantes' }))
    expect(await screen.findByRole('heading', { name: 'Onde você quer pedir hoje?' })).toBeInTheDocument()
  })

  it('shows empty orders state and allows switching back to restaurants', async () => {
    const user = userEvent.setup()
    const { stores, orders } = createPorts({
      orders: {
        listCustomerOrders: vi.fn().mockResolvedValue([]),
      },
    })

    render(
      <StoreSelectorScreen
        stores={stores}
        orders={orders}
        customer={customer}
        onSelectStore={vi.fn()}
        onLogout={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'Meus Pedidos' }))

    expect(await screen.findByText('Nenhum pedido realizado')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ver restaurantes' }))
    expect(await screen.findByRole('heading', { name: 'Onde você quer pedir hoje?' })).toBeInTheDocument()
  })

  it('shows error state when loading customer orders fails and allows retry', async () => {
    const user = userEvent.setup()
    const { stores, orders } = createPorts({
      orders: {
        listCustomerOrders: vi
          .fn()
          .mockRejectedValueOnce(new Error('Failed to load orders'))
          .mockResolvedValueOnce(sampleOrders),
      },
    })

    render(
      <StoreSelectorScreen
        stores={stores}
        orders={orders}
        customer={customer}
        onSelectStore={vi.fn()}
        onLogout={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'Meus Pedidos' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load orders',
    )

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Pedido #012')).toBeInTheDocument()
  })

  it('displays fallback error message when loading orders throws non-Error', async () => {
    const user = userEvent.setup()
    const { stores, orders } = createPorts({
      orders: {
        listCustomerOrders: vi.fn().mockRejectedValueOnce('string error'),
      },
    })

    render(
      <StoreSelectorScreen
        stores={stores}
        orders={orders}
        customer={customer}
        onSelectStore={vi.fn()}
        onLogout={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'Meus Pedidos' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o histórico de pedidos.',
    )
  })

  it('polls orders every 5 seconds while on orders tab', () => {
    vi.useFakeTimers()
    const { stores, orders } = createPorts()

    render(
      <StoreSelectorScreen
        stores={stores}
        orders={orders}
        customer={customer}
        onSelectStore={vi.fn()}
        onLogout={vi.fn()}
      />,
    )

    // Switch to orders tab
    fireEvent.click(screen.getByRole('tab', { name: 'Meus Pedidos' }))
    expect(orders.listCustomerOrders).toHaveBeenCalledTimes(1)

    // Advance 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(orders.listCustomerOrders).toHaveBeenCalledTimes(2)

    // Advance another 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(orders.listCustomerOrders).toHaveBeenCalledTimes(3)

    vi.useRealTimers()
  })
})
