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
    { slug: 'brasa-burgers', name: 'Brasa Burgers', category: 'Hamburgueria' },
    { slug: 'bella-nonna', name: 'Cantina Bella Nonna', category: 'Italiana' },
    { slug: 'acai-bowls', name: 'Açaí & Bowls Universitário', category: 'Saudável' },
    { slug: 'lanchonete-bem-te-vi', name: 'Lanchonete Bem-te-vi' },
    { slug: 'custom-cafe', name: 'Café do Campus', category: 'Café' },
    { slug: 'quiosque-novo', name: 'Quiosque Novo', category: 'Salgados' },
    { slug: 'quiosque-sem-cat', name: 'Quiosque Sem Cat' },
    {
      slug: 'emporio-campus',
      name: 'Empório Campus & Mercearia',
      category: 'Conveniência',
      segment: 'market',
    },
    {
      slug: 'conveniencia-central',
      name: 'Conveniência Central',
      category: 'Snacks & Bebidas',
      segment: 'market',
    },
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

  it('filters stores via search query and clears search', async () => {
    const user = userEvent.setup()
    const { stores, orders } = createPorts()

    render(
      <StoreSelectorScreen
        stores={stores}
        orders={orders}
        customer={customer}
        onSelectStore={vi.fn()}
      />,
    )

    expect(await screen.findByRole('heading', { name: 'Brasa Burgers' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cantina Bella Nonna' })).toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText(/Buscar por nome/i)
    await user.type(searchInput, 'Brasa')

    expect(screen.getByRole('heading', { name: 'Brasa Burgers' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Cantina Bella Nonna' })).not.toBeInTheDocument()

    // Clear search
    await user.click(screen.getByRole('button', { name: 'Limpar busca' }))
    expect(screen.getByRole('heading', { name: 'Cantina Bella Nonna' })).toBeInTheDocument()
  })

  it('filters stores by category chip and handles empty filter results', async () => {
    const user = userEvent.setup()
    const { stores, orders } = createPorts()

    render(
      <StoreSelectorScreen
        stores={stores}
        orders={orders}
        customer={customer}
        onSelectStore={vi.fn()}
      />,
    )

    expect(await screen.findByRole('heading', { name: 'Brasa Burgers' })).toBeInTheDocument()

    // Filter by Burgers
    await user.click(screen.getByRole('button', { name: 'Burgers' }))
    expect(screen.getByRole('heading', { name: 'Brasa Burgers' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Cantina Bella Nonna' })).not.toBeInTheDocument()

    // Filter by Mais Próximos
    await user.click(screen.getByRole('button', { name: 'Mais Próximos' }))
    expect(screen.getByRole('heading', { name: 'Brasa Burgers' })).toBeInTheDocument()

    // Search with non-matching term to test empty state and reset
    const searchInput = screen.getByPlaceholderText(/Buscar por nome/i)
    await user.type(searchInput, 'inexistente')
    expect(await screen.findByText('Nenhum restaurante encontrado')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(await screen.findByRole('heading', { name: 'Brasa Burgers' })).toBeInTheDocument()
  })

  it('renders guest mode for unauthenticated customer and triggers onLoginRequest', async () => {
    const user = userEvent.setup()
    const onLoginRequest = vi.fn()
    const { stores, orders } = createPorts()

    render(
      <StoreSelectorScreen
        stores={stores}
        orders={orders}
        customer={null}
        onSelectStore={vi.fn()}
        onLoginRequest={onLoginRequest}
      />,
    )

    expect(await screen.findByText('Praça de Alimentação')).toBeInTheDocument()
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Meus Pedidos' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Entrar / Cadastrar' }))
    expect(onLoginRequest).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Login com Google' }))
    expect(onLoginRequest).toHaveBeenCalledTimes(2)
  })

  it('switches to markets tab, filters market stores, and handles category chips', async () => {
    const user = userEvent.setup()
    const onSelectStore = vi.fn()
    const { stores, orders } = createPorts()

    render(
      <StoreSelectorScreen
        stores={stores}
        orders={orders}
        customer={customer}
        onSelectStore={onSelectStore}
      />,
    )

    expect(await screen.findByRole('heading', { name: 'Brasa Burgers' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Empório Campus & Mercearia' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'TOPA Mercados' }))

    expect(await screen.findByRole('heading', { name: 'Empório Campus & Mercearia' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Conveniência Central' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Brasa Burgers' })).not.toBeInTheDocument()

    // Test market chips
    await user.click(screen.getByRole('button', { name: 'Conveniência' }))
    expect(screen.getByRole('heading', { name: 'Empório Campus & Mercearia' })).toBeInTheDocument()

    // Test empty search in markets tab
    const searchInput = screen.getByPlaceholderText(/Buscar no mercado/i)
    await user.type(searchInput, 'inexistente')
    expect(await screen.findByText('Nenhum mercado encontrado')).toBeInTheDocument()
    expect(screen.getByText(/produtos de conveniência/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(await screen.findByRole('heading', { name: 'Empório Campus & Mercearia' })).toBeInTheDocument()

    // Clicking store in markets calls onSelectStore
    await user.click(screen.getByRole('button', { name: 'Pedir em Empório Campus & Mercearia' }))
    expect(onSelectStore).toHaveBeenCalledWith('emporio-campus')
  })

  it('displays session notice banner and allows dismissing it', async () => {
    const user = userEvent.setup()
    const { stores, orders } = createPorts()

    render(
      <StoreSelectorScreen
        stores={stores}
        orders={orders}
        customer={customer}
        sessionNotice="Sessão temporária expirada."
        onSelectStore={vi.fn()}
      />,
    )

    expect(screen.getByText('Sessão temporária expirada.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Fechar aviso' }))
    expect(screen.queryByText('Sessão temporária expirada.')).not.toBeInTheDocument()
  })

  it('handles user location prompt and button click', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success) => {
        success({
          coords: {
            latitude: -23.4828,
            longitude: -46.5005,
          },
        })
      }),
    }
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: mockGeolocation,
    })

    const { stores, orders } = createPorts()

    render(
      <StoreSelectorScreen
        stores={stores}
        orders={orders}
        customer={customer}
        onSelectStore={vi.fn()}
      />,
    )

    expect(await screen.findByText(/Localização ativa/i)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('falls back to default campus coordinates when location permission is denied', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((_success, error) => {
        error(new Error('User denied Geolocation'))
      }),
    }
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: mockGeolocation,
    })

    const { stores, orders } = createPorts()

    render(
      <StoreSelectorScreen
        stores={stores}
        orders={orders}
        customer={customer}
        onSelectStore={vi.fn()}
      />,
    )

    expect(await screen.findByText(/Praça de Alimentação EACH-USP/i)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('resets active tab to restaurants when customer becomes null while on orders tab', async () => {
    const user = userEvent.setup()
    const { stores, orders } = createPorts()

    const { rerender } = render(
      <StoreSelectorScreen
        stores={stores}
        orders={orders}
        customer={customer}
        onSelectStore={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'Meus Pedidos' }))
    expect(screen.getByRole('tab', { name: 'Meus Pedidos' })).toHaveAttribute('aria-selected', 'true')

    rerender(
      <StoreSelectorScreen
        stores={stores}
        orders={orders}
        customer={null}
        onSelectStore={vi.fn()}
      />,
    )

    expect(screen.getByRole('tab', { name: 'Restaurantes' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: 'Meus Pedidos' })).not.toBeInTheDocument()
  })
})
