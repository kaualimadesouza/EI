import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '../../domain/menu'
import type { OrderDraft, OrderSummary } from '../../domain/order'
import type { Adapters } from '../../ports/adapters'
import { OrderRejectedError } from '../../ports/orders'
import { LocalMenu } from '../../adapters/local/local-menu'
import { LocalOrders } from '../../adapters/local/local-orders'
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

const xsalada: OrderDraft = { lines: [{ productId: 'xsalada', quantity: 2 }], dineIn: true, paymentMethod: 'card' }
const coxinha: OrderDraft = { lines: [{ productId: 'coxinha', quantity: 1 }], dineIn: false, paymentMethod: 'pix' }

function demoStore() {
  const storage = new MemoryStorage()
  const menu = new LocalMenu(storage)
  const ordersAt = (clock: () => Date) => new LocalOrders(menu, storage, clock)
  const adapters: Adapters = {
    mode: 'demo',
    connection: { isReachable: () => Promise.resolve(true) },
    menu,
    orders: ordersAt(() => NOW),
  }
  return { adapters, menu, ordersAt }
}

function renderPainel(adapters: Adapters) {
  return render(<PainelApp adapters={adapters} now={() => NOW} />)
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
    expect(screen.getByText('Modo demonstração: dados deste navegador, atualiza a cada 3 s')).toBeInTheDocument()
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
    expect((await adapters.orders.list('2026-10-26'))[0].status).toBe('received')
  })

  it('files a delivered order under the day, with its time and total', async () => {
    const user = userEvent.setup()
    const { adapters, ordersAt } = demoStore()
    await ordersAt(at(26, 15, 58)).place(xsalada)
    const [order] = await adapters.orders.list('2026-10-26')
    await adapters.orders.setStatus(order.id, 'preparing')
    await adapters.orders.setStatus(order.id, 'ready')
    renderPainel(adapters)

    await user.click(await screen.findByRole('button', { name: 'Entregar' }))

    expect(await screen.findByText('Entregues hoje (1)')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Pedido 001 foi entregue.')
    expect(screen.getByText('2× X-salada')).toBeInTheDocument()
    expect(screen.getByText('15:58')).toBeInTheDocument()
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
    expect((await menu.list()).find((p) => p.id === 'coxinha')?.available).toBe(false)

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
      menu: { list: () => Promise.reject(new Error('down')), setAvailability: vi.fn() },
      orders: { place: vi.fn(), list: () => Promise.reject(new Error('down')), setStatus: vi.fn() },
    }

    renderPainel(failing)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O servidor local não responde. Os números abaixo podem estar desatualizados.',
    )
    expect(screen.getByText('Servidor local, atualiza a cada 3 s')).toBeInTheDocument()
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
      menu: { list: () => Promise.resolve([suco]), setAvailability: () => Promise.reject(new Error('network')) },
      orders: { place: vi.fn(), list: () => Promise.resolve([order]), setStatus },
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

    render(<PainelApp adapters={adapters} />)

    expect(await screen.findByRole('heading', { name: 'Painel do lojista' })).toBeInTheDocument()
  })
})
