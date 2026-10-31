import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '../../domain/menu'
import type { OrderDraft, OrderSummary } from '../../domain/order'
import { DEMO_STORE_SLUG } from '../../domain/store'
import type { Adapters } from '../../ports/adapters'
import { OrderRejectedError } from '../../ports/orders'
import { LocalAuth } from '../../adapters/local/local-auth'
import { LocalCustomerAuth } from '../../adapters/local/local-customer-auth'
import { LocalMenu } from '../../adapters/local/local-menu'
import { LocalOrders } from '../../adapters/local/local-orders'
import { LocalPrinterAdapter } from '../../adapters/local/local-printer'
import { LocalRecommendations } from '../../adapters/local/local-recommendations'
import { LocalStores } from '../../adapters/local/local-stores'
import { UnavailableBuzzer } from '../../adapters/unavailable/unavailable-buzzer'
import { UnavailableTag } from '../../adapters/unavailable/unavailable-tag'
import { UnavailableWakeLock } from '../../adapters/unavailable/unavailable-wake-lock'
import { PainelApp, POLL_MS, UNDO_MS } from './PainelApp'

class MemoryStorage {
  data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

// 16h on a Monday; yesterday's orders land on Sunday
const NOW = new Date(2026, 9, 26, 16, 0)
const at = (day: number, hour: number, minute = 0) => () => new Date(2026, 9, day, hour, minute)

const xsalada: OrderDraft = { storeSlug: DEMO_STORE_SLUG, lines: [{ productId: 'xsalada', quantity: 2 }], dineIn: true, paymentMethod: 'card' }
const coxinha: OrderDraft = { storeSlug: DEMO_STORE_SLUG, lines: [{ productId: 'coxinha', quantity: 1 }], dineIn: false, paymentMethod: 'pix' }

function demoStore(storeSlug: string = DEMO_STORE_SLUG) {
  const storage = new MemoryStorage()
  const menu = new LocalMenu(storage)
  const ordersAt = (clock: () => Date) => new LocalOrders(menu, storage, clock)
  const adapters: Adapters = {
    mode: 'demo',
    connection: { isReachable: () => Promise.resolve(true) },
    menu,
    orders: ordersAt(() => NOW),
    auth: new LocalAuth({
      storage,
      initialMerchant: { email: 'admin@bemtevi.topa.com', storeSlug },
      initialToken: 'demo-token',
    }),
    customerAuth: new LocalCustomerAuth({ storage }),
    stores: new LocalStores(),
    recommendations: new LocalRecommendations(menu),
    voice: { isSupported: () => true, startListening: vi.fn().mockReturnValue(() => {}) },
    printer: new LocalPrinterAdapter(),
    nfc: { scan: () => Promise.resolve({ kind: 'no-nfc' as const }) },
    tag: new UnavailableTag(),
    buzzer: new UnavailableBuzzer(),
    wakeLock: new UnavailableWakeLock(),
  }
  return { adapters, menu, ordersAt }
}

function renderPainel(adapters: Adapters) {
  return render(<PainelApp adapters={adapters} storeSlug={DEMO_STORE_SLUG} now={() => NOW} />)
}

afterEach(() => {
  vi.useRealTimers()
})

describe('PainelApp', () => {
  it('sums the day and compares it with yesterday', async () => {
    const { adapters, ordersAt } = demoStore()
    await ordersAt(at(25, 12)).place(xsalada)
    await ordersAt(at(26, 9)).place(xsalada)
    await ordersAt(at(26, 15, 59)).place(coxinha)

    renderPainel(adapters)

    const kpis = await screen.findByText('Faturamento')
    const tiles = kpis.closest('dl')!
    expect(await within(tiles).findByText('R$ 54,70')).toBeInTheDocument()
    expect(within(tiles).getByText('▲ +19% vs ontem')).toHaveClass('text-teal')
    expect(within(tiles).getByText('2')).toBeInTheDocument()
    expect(within(tiles).getByText('▲ +100% vs ontem')).toBeInTheDocument()
    expect(within(tiles).getByText('▼ -40% vs ontem')).toHaveClass('text-warning')
    expect(within(tiles).getByText('50%')).toBeInTheDocument()
    expect(within(tiles).getByText('Sem base para comparar com ontem')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Painel do lojista' })).toBeInTheDocument()
    expect(screen.getByText('Segunda-feira, 26 de outubro', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Modo demonstração: dados deste navegador, atualizados a cada 3 s')).toBeInTheDocument()
  })

  it('says a flat day is flat and leaves the take-away share without a good side', async () => {
    const { adapters, ordersAt } = demoStore()
    await ordersAt(at(25, 12)).place(coxinha)
    await ordersAt(at(26, 12)).place(coxinha)
    await ordersAt(at(26, 13)).place(coxinha)

    renderPainel(adapters)

    const tiles = (await screen.findByText('Faturamento')).closest('dl')!
    expect(await within(tiles).findAllByText('▲ +100% vs ontem')).toHaveLength(2)
    expect(within(tiles).getAllByText('Igual a ontem')).toHaveLength(2)
  })

  it('shows a lower take-away share in muted text, never as bad news', async () => {
    const { adapters, ordersAt } = demoStore()
    await ordersAt(at(25, 12)).place(coxinha)
    await ordersAt(at(26, 12)).place(xsalada)
    await ordersAt(at(26, 13)).place(coxinha)

    renderPainel(adapters)

    const tiles = (await screen.findByText('Faturamento')).closest('dl')!
    expect(await within(tiles).findByText('▼ -50% vs ontem')).toHaveClass('text-muted')
  })

  it('lays the open orders out by kitchen step with their age, items and how they leave', async () => {
    const { adapters, ordersAt } = demoStore()
    await ordersAt(at(26, 15, 58)).place(xsalada)
    await ordersAt(at(26, 15, 54)).place(coxinha)
    await ordersAt(at(26, 16)).place(coxinha)

    renderPainel(adapters)

    const received = await screen.findByRole('region', { name: 'Recebidos' })
    const first = await within(received).findByRole('article', { name: 'Pedido 001' })
    expect(within(first).getByText('há 2 min')).toHaveClass('text-muted')
    expect(within(first).getByText('Comer aqui')).toBeInTheDocument()
    expect(within(first).getByText('2×')).toBeInTheDocument()
    expect(within(first).getByText('X-salada')).toBeInTheDocument()
    const slow = within(received).getByRole('article', { name: 'Pedido 002' })
    expect(within(slow).getByText('há 6 min')).toHaveClass('text-warning')
    expect(within(slow).getByText('Para viagem')).toBeInTheDocument()
    expect(within(received).getByRole('article', { name: 'Pedido 003' })).toHaveTextContent('agora')
    expect(within(screen.getByRole('region', { name: 'Prontos' })).getByText('Nenhum pedido aqui.')).toBeInTheDocument()
    expect(screen.getByText('Entregues hoje (0)')).toBeInTheDocument()
    expect(screen.getByText('Nenhum pedido entregue ainda.')).toBeInTheDocument()
  })

  it('moves an order through the kitchen and lets the merchant undo the last step', async () => {
    const user = userEvent.setup()
    const { adapters, ordersAt } = demoStore()
    await ordersAt(at(26, 15, 58)).place(xsalada)
    renderPainel(adapters)

    await user.click(await screen.findByRole('button', { name: 'Começar preparo' }))

    const preparing = screen.getByRole('region', { name: 'Em preparo' })
    expect(await within(preparing).findByRole('article', { name: 'Pedido 001' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Pedido 001 foi para o preparo.')

    await user.click(screen.getByRole('button', { name: 'Desfazer' }))

    const received = screen.getByRole('region', { name: 'Recebidos' })
    expect(await within(received).findByRole('article', { name: 'Pedido 001' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect((await adapters.orders.list('2026-10-26', DEMO_STORE_SLUG))[0].status).toBe('received')
  })

  it('files a delivered order under the day, with its time and total', async () => {
    const user = userEvent.setup()
    const { adapters, ordersAt } = demoStore()
    await ordersAt(at(26, 15, 58)).place(xsalada)
    const [order] = await adapters.orders.list('2026-10-26', DEMO_STORE_SLUG)
    await adapters.orders.setStatus(order.id, 'preparing')
    await adapters.orders.setStatus(order.id, 'ready')
    renderPainel(adapters)

    await user.click(await screen.findByRole('button', { name: 'Entregar' }))

    expect(await screen.findByText('Entregues hoje (1)')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Pedido 001 foi entregue.')
    expect(screen.getByText('2× X-salada')).toBeInTheDocument()
    expect(screen.getByText('15:58')).toBeInTheDocument()
    const cupomBtn = screen.getByRole('button', { name: 'Cupom' })
    await user.click(cupomBtn)
    expect(screen.getByRole('dialog', { name: 'Visualização de impressão ESC-POS' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
  })

  it('locks the buttons briefly after a move, so a double tap moves the order once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { adapters, ordersAt } = demoStore()
    await ordersAt(at(26, 15, 58)).place(xsalada)
    await ordersAt(at(26, 15, 59)).place(coxinha)
    renderPainel(adapters)

    const buttons = await screen.findAllByRole('button', { name: 'Começar preparo' })
    await user.click(buttons[0])

    expect(screen.getByRole('button', { name: 'Começar preparo' })).toBeDisabled()
    await act(() => vi.advanceTimersByTimeAsync(400))
    expect(screen.getByRole('button', { name: 'Começar preparo' })).toBeEnabled()
  })

  it('drops the undo offer after a few seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { adapters, ordersAt } = demoStore()
    await ordersAt(at(26, 15, 58)).place(xsalada)
    renderPainel(adapters)

    await user.click(await screen.findByRole('button', { name: 'Começar preparo' }))
    expect(await screen.findByRole('status')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(UNDO_MS))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('picks up orders placed on a totem while the dashboard is open', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { adapters, ordersAt } = demoStore()
    renderPainel(adapters)
    expect(await screen.findByText('Entregues hoje (0)')).toBeInTheDocument()

    await ordersAt(at(26, 16)).place(coxinha)
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS))

    expect(await screen.findByRole('article', { name: 'Pedido 001' })).toBeInTheDocument()
  })

  it('warns about orders waiting ten minutes or more', async () => {
    const { adapters, ordersAt } = demoStore()
    await ordersAt(at(26, 15, 48)).place(xsalada)
    const view = renderPainel(adapters)

    expect(await screen.findByRole('alert')).toHaveTextContent('O pedido 001 espera há 12 min.')
    expect(screen.getByRole('article', { name: 'Pedido 001' })).toHaveClass('bg-warning-tint')

    await ordersAt(at(26, 15, 40)).place(coxinha)
    view.unmount()
    renderPainel(adapters)

    expect(await screen.findByText('2 pedidos esperam há mais de 10 min.')).toBeInTheDocument()
  })

  it('marks a product sold out for the totems and puts it back on sale', async () => {
    const user = userEvent.setup()
    const { adapters, ordersAt, menu } = demoStore()
    await ordersAt(at(26, 12)).place(coxinha)
    renderPainel(adapters)

    const toggle = await screen.findByRole('switch', { name: 'Coxinha à venda' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    const row = toggle.closest('tr')!
    expect(within(row).getByText('R$ 8,90')).toBeInTheDocument()
    expect(within(row).getByText('1')).toBeInTheDocument()

    await user.click(toggle)

    expect(await screen.findByRole('alert')).toHaveTextContent('Esgotados no totem: Coxinha.')
    expect(screen.getByRole('switch', { name: 'Coxinha à venda' })).toHaveAttribute('aria-checked', 'false')
    expect(within(screen.getByRole('switch', { name: 'Coxinha à venda' }).closest('tr')!).getByText('Esgotado')).toBeInTheDocument()
    expect((await menu.load(DEMO_STORE_SLUG)).products.find((p) => p.id === 'coxinha')?.available).toBe(false)

    await user.click(screen.getByRole('switch', { name: 'Coxinha à venda' }))

    expect(await screen.findByRole('switch', { name: 'Coxinha à venda' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText('Esgotados no totem: Coxinha.')).not.toBeInTheDocument()
  })

  it('names the suggestion rule behind each product, and says when there is none', async () => {
    const { adapters } = demoStore()
    renderPainel(adapters)

    const suco = (await screen.findByRole('switch', { name: 'Suco de laranja à venda' })).closest('tr')!
    expect(within(suco).getByText('Oferecido após um lanche sem bebida')).toBeInTheDocument()
    const agua = screen.getByRole('switch', { name: 'Água sem gás à venda' }).closest('tr')!
    expect(within(agua).getByText('Sem regra')).toHaveClass('text-muted')
  })

  it('charts the orders per hour, labelling only the peak', async () => {
    const { adapters, ordersAt } = demoStore()
    await ordersAt(at(26, 12)).place(coxinha)
    await ordersAt(at(26, 12, 30)).place(coxinha)
    await ordersAt(at(26, 15)).place(coxinha)
    renderPainel(adapters)

    const chart = (await screen.findByText('Pedidos por hora')).closest('figure')!
    const table = within(chart).getByRole('table', { name: 'Pedidos por hora, hoje' })
    expect(await within(table).findByRole('row', { name: '12h 2' })).toBeInTheDocument()
    expect(within(table).getByRole('row', { name: '15h 1' })).toBeInTheDocument()
    expect(within(chart).getByText('12h: 2 pedidos')).toBeInTheDocument()
    expect(within(chart).getByText('15h: 1 pedido')).toBeInTheDocument()
    expect(within(chart).getAllByText('16h')[0]).toHaveClass('font-semibold')
  })

  it('warns when the server stops answering and keeps the last numbers', async () => {
    const failing: Adapters = {
      mode: 'api',
      connection: { isReachable: () => Promise.resolve(false) },
      menu: { load: () => Promise.reject(new Error('down')), setAvailability: vi.fn(), create: vi.fn(), update: vi.fn() },
      orders: { place: vi.fn(), list: () => Promise.reject(new Error('down')), setStatus: vi.fn(), statusOf: vi.fn(), listCustomerOrders: vi.fn() },
      auth: {
        login: vi.fn(),
        logout: vi.fn(),
        getToken: () => 'token',
        getMerchant: () => ({ email: 'admin@bemtevi.topa.com', storeSlug: DEMO_STORE_SLUG }),
      },
      customerAuth: new LocalCustomerAuth({ storage: null }),
      stores: new LocalStores(),
      recommendations: { getRecommendations: vi.fn() },
      voice: { isSupported: () => true, startListening: vi.fn().mockReturnValue(() => {}) },
      printer: new LocalPrinterAdapter(),
      nfc: { scan: () => Promise.resolve({ kind: 'no-nfc' as const }) },
      tag: new UnavailableTag(),
      buzzer: new UnavailableBuzzer(),
      wakeLock: new UnavailableWakeLock(),
    }

    renderPainel(failing)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O servidor não responde. Os números abaixo podem estar desatualizados.',
    )
    expect(screen.getByText('Dados do servidor, atualizados a cada 3 s')).toBeInTheDocument()
  })

  it('shows why a move or a toggle failed, in words for the merchant', async () => {
    const user = userEvent.setup()
    const order: OrderSummary = {
      id: 'o1',
      number: 4,
      status: 'received',
      dineIn: true,
      paymentMethod: 'card',
      totalCents: 990,
      createdAt: NOW.toISOString(),
      items: [{ productId: 'suco', name: 'Suco de laranja', quantity: 1, unitPriceCents: 990 }],
    }
    const suco: Product = { id: 'suco', name: 'Suco de laranja', description: '', category: 'bebidas', priceCents: 990, available: true }
    const setStatus = vi
      .fn<(id: string, status: OrderSummary['status']) => Promise<OrderSummary>>()
      .mockRejectedValueOnce(new OrderRejectedError('O pedido 004 não pode passar de recebido para em preparo.'))
      .mockRejectedValueOnce(new Error('network'))
    const adapters: Adapters = {
      mode: 'api',
      connection: { isReachable: () => Promise.resolve(true) },
      menu: {
        load: () => Promise.resolve({ store: { slug: 'cantina-central', name: 'Cantina Central' }, products: [suco] }),
        setAvailability: () => Promise.reject(new Error('network')),
        create: vi.fn(),
        update: vi.fn(),
      },
      orders: { place: vi.fn(), list: () => Promise.resolve([order]), setStatus, statusOf: vi.fn(), listCustomerOrders: vi.fn() },
      auth: {
        login: vi.fn(),
        logout: vi.fn(),
        getToken: () => 'token',
        getMerchant: () => ({ email: 'admin@bemtevi.topa.com', storeSlug: DEMO_STORE_SLUG }),
      },
      customerAuth: new LocalCustomerAuth({ storage: null }),
      stores: new LocalStores(),
      recommendations: { getRecommendations: vi.fn() },
      voice: { isSupported: () => true, startListening: vi.fn().mockReturnValue(() => {}) },
      printer: new LocalPrinterAdapter(),
      nfc: { scan: () => Promise.resolve({ kind: 'no-nfc' as const }) },
      tag: new UnavailableTag(),
      buzzer: new UnavailableBuzzer(),
      wakeLock: new UnavailableWakeLock(),
    }
    renderPainel(adapters)

    await user.click(await screen.findByRole('button', { name: 'Começar preparo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('O pedido 004 não pode passar de recebido para em preparo.')

    // past the double-tap guard
    await act(() => new Promise((resolve) => setTimeout(resolve, 450)))
    await user.click(screen.getByRole('button', { name: 'Começar preparo' }))
    expect(await screen.findByText('Não foi possível mudar o pedido. Tente de novo.')).toBeInTheDocument()

    await user.click(screen.getByRole('switch', { name: 'Suco de laranja à venda' }))
    expect(await screen.findByText('Não foi possível mudar Suco de laranja. Tente de novo.')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('uses the real clock by default', async () => {
    const { adapters } = demoStore()

    render(<PainelApp adapters={adapters} storeSlug={DEMO_STORE_SLUG} />)

    expect(await screen.findByRole('heading', { name: 'Painel do lojista' })).toBeInTheDocument()
  })

  it('runs the store in the address: its name, its orders today and yesterday, its menu toggles', async () => {
    const user = userEvent.setup()
    const suco: Product = { id: 'suco', name: 'Suco de laranja', description: '', category: 'bebidas', priceCents: 990, available: true }
    const list = vi.fn<(businessDate: string, storeSlug: string) => Promise<OrderSummary[]>>().mockResolvedValue([])
    const load = vi.fn((slug: string) => Promise.resolve({ store: { slug, name: 'Cantina Central' }, products: [suco] }))
    const setAvailability = vi.fn((_id: string, available: boolean) => Promise.resolve({ ...suco, available }))
    const adapters: Adapters = {
      mode: 'api',
      connection: { isReachable: () => Promise.resolve(true) },
      menu: { load, setAvailability, create: vi.fn(), update: vi.fn() },
      orders: { place: vi.fn(), list, setStatus: vi.fn(), statusOf: vi.fn(), listCustomerOrders: vi.fn() },
      auth: {
        login: vi.fn(),
        logout: vi.fn(),
        getToken: () => 'token',
        getMerchant: () => ({ email: 'admin@bemtevi.topa.com', storeSlug: 'cantina-central' }),
      },
      customerAuth: new LocalCustomerAuth({ storage: null }),
      stores: new LocalStores(),
      recommendations: { getRecommendations: vi.fn() },
      voice: { isSupported: () => true, startListening: vi.fn().mockReturnValue(() => {}) },
      printer: new LocalPrinterAdapter(),
      nfc: { scan: () => Promise.resolve({ kind: 'no-nfc' as const }) },
      tag: new UnavailableTag(),
      buzzer: new UnavailableBuzzer(),
      wakeLock: new UnavailableWakeLock(),
    }

    render(<PainelApp adapters={adapters} storeSlug="cantina-central" now={() => NOW} />)

    expect(await screen.findByText('Cantina Central')).toBeInTheDocument()
    expect(screen.queryByText('Lanchonete Bem-te-vi')).not.toBeInTheDocument()
    expect(load).toHaveBeenCalledWith('cantina-central')
    expect(list).toHaveBeenCalledWith('2026-10-26', 'cantina-central')
    expect(list).toHaveBeenCalledWith('2026-10-25', 'cantina-central')
    await user.click(await screen.findByRole('switch', { name: 'Suco de laranja à venda' }))
    expect(setAvailability).toHaveBeenCalledWith('suco', false, 'cantina-central')
  })

  it('never shows another store name while the store is still loading', () => {
    const adapters: Adapters = {
      ...demoStore('cantina-central').adapters,
      menu: { load: () => new Promise(() => {}), setAvailability: vi.fn(), create: vi.fn(), update: vi.fn() },
      orders: { place: vi.fn(), list: () => new Promise(() => {}), setStatus: vi.fn(), statusOf: vi.fn(), listCustomerOrders: vi.fn() },
    }

    render(<PainelApp adapters={adapters} storeSlug="cantina-central" now={() => NOW} />)

    expect(screen.queryByText('Lanchonete Bem-te-vi')).not.toBeInTheDocument()
  })

  it('tells the merchant the store in the address does not exist, and stops asking for its orders', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { adapters } = demoStore('padaria-inexistente')
    const list = vi.spyOn(adapters.orders, 'list')

    render(<PainelApp adapters={adapters} storeSlug="padaria-inexistente" now={() => NOW} />)

    expect(await screen.findByRole('heading', { name: 'Loja não encontrada' })).toBeInTheDocument()
    expect(screen.getByText('Confira o identificador da loja no endereço do painel.')).toBeInTheDocument()
    expect(screen.queryByText(/O servidor não responde/)).not.toBeInTheDocument()
    const calls = list.mock.calls.length
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS * 3))
    expect(list).toHaveBeenCalledTimes(calls)
  })

  it('triggers onSwitchToTotem when clicking the totem return buttons', async () => {
    const user = userEvent.setup()
    const { adapters } = demoStore()
    const onSwitch = vi.fn()

    render(<PainelApp adapters={adapters} storeSlug={DEMO_STORE_SLUG} now={() => NOW} onSwitchToTotem={onSwitch} />)

    const buttons = await screen.findAllByRole('button', { name: 'Abrir o totem' })
    expect(buttons.length).toBe(2)
    await user.click(buttons[0])
    await user.click(buttons[1])
    expect(onSwitch).toHaveBeenCalledTimes(2)
  })

  it('renders login screen when not logged in', () => {
    const { adapters } = demoStore()
    adapters.auth.logout()

    render(<PainelApp adapters={adapters} storeSlug={DEMO_STORE_SLUG} now={() => NOW} />)

    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(
      screen.getByText(
        /Ao entrar, você concorda com a Política de Privacidade \(LGPD\)\. Seus dados de acesso são utilizados exclusivamente para autenticação e gestão da loja\./,
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Pedidos em andamento')).not.toBeInTheDocument()
  })

  it('logs in via login form and shows the dashboard', async () => {
    const user = userEvent.setup()
    const { adapters } = demoStore()
    adapters.auth.logout()

    render(<PainelApp adapters={adapters} storeSlug={DEMO_STORE_SLUG} now={() => NOW} />)

    await user.type(screen.getByLabelText('E-mail'), 'admin@bemtevi.topa.com')
    await user.type(screen.getByLabelText('Senha'), 'topa123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Pedidos em andamento')).toBeInTheDocument()
  })

  it('shows unauthorized screen when merchant store does not match painel store', async () => {
    const user = userEvent.setup()
    const { adapters } = demoStore('outra-loja')

    render(<PainelApp adapters={adapters} storeSlug={DEMO_STORE_SLUG} now={() => NOW} />)

    expect(await screen.findByRole('heading', { name: 'Acesso não autorizado' })).toBeInTheDocument()
    expect(
      screen.getByText(
        `Seu usuário pertence à loja outra-loja. Você não tem permissão para gerenciar a loja ${DEMO_STORE_SLUG}.`,
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sair' }))
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('logs out and returns to login screen when clicking Sair', async () => {
    const user = userEvent.setup()
    const { adapters } = demoStore()

    const { unmount } = render(<PainelApp adapters={adapters} storeSlug={DEMO_STORE_SLUG} now={() => NOW} />)
    expect(await screen.findByText('Pedidos em andamento')).toBeInTheDocument()
    const logoutButtons = screen.getAllByRole('button', { name: 'Sair' })
    expect(logoutButtons.length).toBe(2)
    await user.click(logoutButtons[0])
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByText('Pedidos em andamento')).not.toBeInTheDocument()
    unmount()

    await adapters.auth.login({ email: 'admin@bemtevi.topa.com', password: 'topa123' })
    render(<PainelApp adapters={adapters} storeSlug={DEMO_STORE_SLUG} now={() => NOW} />)
    const headerLogout = screen.getAllByRole('button', { name: 'Sair' })[1]
    await user.click(headerLogout)
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('opens modal, creates a new product, and shows it in the menu table', async () => {
    const user = userEvent.setup()
    const { adapters } = demoStore()

    render(<PainelApp adapters={adapters} storeSlug={DEMO_STORE_SLUG} now={() => NOW} />)
    expect(await screen.findByRole('heading', { name: 'Cardápio' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Novo produto' }))
    expect(screen.getByRole('heading', { name: 'Novo produto' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Nome'), 'Pastel de Frango')
    await user.clear(screen.getByLabelText('Categoria'))
    await user.type(screen.getByLabelText('Categoria'), 'salgados')
    await user.type(screen.getByLabelText('Preço (R$)'), '8,50')
    await user.type(screen.getByLabelText('Descrição'), 'Pastel frito na hora.')
    await user.type(screen.getByLabelText('URL da foto (opcional)'), 'https://example.com/pastel.jpg')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Pastel de Frango')).toBeInTheDocument()
  })

  it('opens modal, edits an existing product, and reflects changes', async () => {
    const user = userEvent.setup()
    const { adapters } = demoStore()

    render(<PainelApp adapters={adapters} storeSlug={DEMO_STORE_SLUG} now={() => NOW} />)
    expect(await screen.findByRole('heading', { name: 'Cardápio' })).toBeInTheDocument()

    const editBtn = await screen.findByRole('button', { name: 'Editar Coxinha' })
    await user.click(editBtn)
    expect(screen.getByRole('heading', { name: 'Editar produto' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nome')).toHaveValue('Coxinha')

    await user.clear(screen.getByLabelText('Nome'))
    await user.type(screen.getByLabelText('Nome'), 'Coxinha Dourada')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Coxinha Dourada')).toBeInTheDocument()
  })

  it('shows problem alert when saving a product fails', async () => {
    const user = userEvent.setup()
    const { adapters } = demoStore()
    vi.spyOn(adapters.menu, 'create').mockRejectedValue(new Error('Falha no banco.'))

    render(<PainelApp adapters={adapters} storeSlug={DEMO_STORE_SLUG} now={() => NOW} />)
    expect(await screen.findByRole('heading', { name: 'Cardápio' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Novo produto' }))
    await user.type(screen.getByLabelText('Nome'), 'Pastel')
    await user.type(screen.getByLabelText('Preço (R$)'), '8,50')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    const alerts = await screen.findAllByText('Falha no banco.')
    expect(alerts.length).toBeGreaterThanOrEqual(1)
  })

  it('shows fallback problem alert when saving a product fails with non-Error', async () => {
    const user = userEvent.setup()
    const { adapters } = demoStore()
    vi.spyOn(adapters.menu, 'create').mockRejectedValue('falha de rede')

    render(<PainelApp adapters={adapters} storeSlug={DEMO_STORE_SLUG} now={() => NOW} />)
    expect(await screen.findByRole('heading', { name: 'Cardápio' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Novo produto' }))
    await user.type(screen.getByLabelText('Nome'), 'Pastel')
    await user.type(screen.getByLabelText('Preço (R$)'), '8,50')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    const alerts = await screen.findAllByText('Não foi possível salvar o produto. Tente de novo.')
    expect(alerts.length).toBeGreaterThanOrEqual(1)
  })

  it('opens ESC/POS ticket preview modal when clicking Cupom on an order card', async () => {
    const user = userEvent.setup()
    const { adapters, ordersAt } = demoStore()
    await ordersAt(at(26, 12)).place(xsalada)

    renderPainel(adapters)
    expect(await screen.findByRole('article', { name: 'Pedido 001' })).toBeInTheDocument()

    const cupomBtn = screen.getByRole('button', { name: 'Cupom' })
    await user.click(cupomBtn)

    expect(screen.getByRole('dialog', { name: 'Visualização de impressão ESC-POS' })).toBeInTheDocument()
    expect(screen.getByText('PEDIDO #1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog', { name: 'Visualização de impressão ESC-POS' })).not.toBeInTheDocument()
  })
})
