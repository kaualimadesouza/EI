import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEMO_CATALOG } from '../../domain/demo-catalog'
import type { Adapters } from '../../ports/adapters'
import type { Product } from '../../domain/menu'
import type { OrderDraft, PlacedOrder } from '../../domain/order'
import { OrderRejectedError } from '../../ports/orders'
import { KioskApp } from './KioskApp'

interface Fakes {
  adapters: Adapters
  place: ReturnType<typeof vi.fn<(draft: OrderDraft) => Promise<PlacedOrder>>>
  list: ReturnType<typeof vi.fn<() => Promise<Product[]>>>
}

function fakes(products: Product[] = DEMO_CATALOG.map((p) => ({ ...p }))): Fakes {
  const list = vi.fn<() => Promise<Product[]>>().mockResolvedValue(products)
  const place = vi
    .fn<(draft: OrderDraft) => Promise<PlacedOrder>>()
    .mockImplementation((draft) => Promise.resolve({ number: 47, totalCents: draft.lines.length * 100 }))
  const adapters: Adapters = {
    mode: 'demo',
    connection: { isReachable: () => Promise.resolve(true) },
    menu: { list, setAvailability: vi.fn() },
    orders: { place, list: vi.fn(), setStatus: vi.fn() },
  }
  return { adapters, place, list }
}

const morning = () => new Date(2026, 9, 26, 8, 0)

function setup(f: Fakes = fakes(), now: () => Date = morning) {
  const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
  render(<KioskApp adapters={f.adapters} now={now} />)
  return { user, ...f }
}

const button = (name: string | RegExp) => screen.getByRole('button', { name })
// role queries match accessible names verbatim, and Intl puts a no-break space after R$
const COMBO_BANNER = 'Adicionar Café + pão de queijo por R$\u00a012,90'

async function startOrder(user: ReturnType<typeof userEvent.setup>, dineIn = true) {
  await user.click(button(dineIn ? /Comer aqui/ : /Levar para viagem/))
  await screen.findByRole('heading', { name: 'Lanches' })
}

describe('KioskApp', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('takes a take-away order from the start screen to the order number', async () => {
    const { user, place } = setup()

    await startOrder(user, false)
    expect(screen.getByText('Para viagem')).toBeInTheDocument()
    await user.click(button(COMBO_BANNER))
    expect(screen.getByText('1 item')).toBeInTheDocument()
    await user.click(button('Ver pedido'))
    expect(screen.getByRole('heading', { name: 'Seu pedido' })).toBeInTheDocument()
    await user.click(button('Pagar'))
    expect(screen.getByRole('heading', { name: 'Como você quer pagar?' })).toBeInTheDocument()
    await user.click(button('Simular aprovação (demo)'))

    expect(await screen.findByLabelText('Pedido número 047')).toBeInTheDocument()
    expect(place).toHaveBeenCalledWith({
      lines: [{ productId: 'combo-cafe', quantity: 1 }],
      dineIn: false,
      paymentMethod: 'card',
    })
  })

  it('offers juice after a sandwich and adds it when accepted', async () => {
    const { user } = setup()
    await startOrder(user)

    await user.click(button('Adicionar X-salada'))
    const sheet = screen.getByRole('dialog', { name: 'Que tal um suco de laranja para acompanhar?' })
    expect(within(sheet).getByText('X-salada adicionado')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Adicionar por R$\u00a09,90' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('R$ 32,80')).toBeInTheDocument()
    expect(screen.getByText('2 itens')).toBeInTheDocument()
  })

  it('offers only once per order', async () => {
    const { user } = setup()
    await startOrder(user)

    await user.click(button('Adicionar Misto quente'))
    await user.click(button('Não, obrigado'))
    await user.click(button('Adicionar Bauru'))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('adds the suggested item from the banner, and the banner leaves', async () => {
    const { user } = setup()
    await startOrder(user)

    await user.click(button(COMBO_BANNER))

    expect(screen.getByText('1 item')).toBeInTheDocument()
    expect(screen.queryByText('Sugestão para agora')).not.toBeInTheDocument()
  })

  it('switches categories and changes quantities on the card', async () => {
    const { user } = setup()
    await startOrder(user)

    await user.click(button('Doces'))
    expect(screen.getByRole('heading', { name: 'Doces' })).toBeInTheDocument()
    expect(button('Doces')).toHaveAttribute('aria-pressed', 'true')
    await user.click(button('Adicionar Pudim'))
    await user.click(button('Mais um Pudim'))
    expect(screen.getByLabelText('2 no pedido')).toBeInTheDocument()
    await user.click(button('Tirar um Pudim'))
    await user.click(button('Tirar um Pudim'))

    expect(screen.queryByLabelText(/no pedido/)).not.toBeInTheDocument()
    expect(button('Ver pedido')).toBeDisabled()
    expect(screen.getByText('Toque em um produto para adicionar.')).toBeInTheDocument()
  })

  it('shows a sold-out product as unavailable', async () => {
    const products = DEMO_CATALOG.map((p) => (p.id === 'bauru' ? { ...p, available: false } : { ...p }))
    const { user } = setup(fakes(products))
    await startOrder(user)

    expect(button('Bauru, esgotado')).toBeDisabled()
    expect(screen.getByText('Esgotado')).toBeInTheDocument()
  })

  it('edits the order in the bag and goes back to the menu when it empties', async () => {
    const { user } = setup()
    await startOrder(user)
    await user.click(button('Doces'))
    await user.click(button('Adicionar Brownie'))
    await user.click(button('Ver pedido'))

    await user.click(button('Mais um Brownie'))
    expect(screen.getByText('Total, 2 itens')).toBeInTheDocument()
    await user.click(button('Tirar um Brownie'))
    await user.click(button('Continuar comprando'))
    expect(screen.getByRole('heading', { name: 'Doces' })).toBeInTheDocument()
    await user.click(button('Ver pedido'))
    expect(screen.getByText('Total, 1 item')).toBeInTheDocument()
    await user.click(button('Remover Brownie'))

    expect(screen.getByRole('heading', { name: 'Doces' })).toBeInTheDocument()
  })

  it('pays with Pix, and renews the code when it expires', async () => {
    const { user } = setup()
    await startOrder(user)
    await user.click(button('Adicionar Bauru'))
    await user.click(button('Não, obrigado'))
    await user.click(button('Ver pedido'))
    await user.click(button('Pagar'))

    await user.click(button(/Pix/))
    expect(button(/Pix/)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('img', { name: 'Código Pix de demonstração' })).toBeInTheDocument()
    expect(screen.getByText('O código vale por 5:00')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(300_000))
    expect(screen.getByText('O código Pix expirou.')).toBeInTheDocument()
    await user.click(button('Gerar novo código'))
    expect(screen.getByText('O código vale por 5:00')).toBeInTheDocument()
    await user.click(button(/Cartão ou celular/))

    expect(button(/Cartão ou celular/)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Encoste aqui, atrás da tela')).toBeInTheDocument()
  })

  it('handles a declined card and offers Pix instead', async () => {
    const { user } = setup()
    await startOrder(user)
    await user.click(button('Adicionar Americano'))
    await user.click(button('Não, obrigado'))
    await user.click(button('Ver pedido'))
    await user.click(button('Pagar'))

    await user.click(button('Simular recusa (demo)'))
    expect(screen.getByRole('alert')).toHaveTextContent('Pagamento não aprovado. Tente de novo ou pague com Pix.')
    await user.click(button('Tentar de novo'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(button('Simular recusa (demo)'))
    await user.click(button('Pagar com Pix'))

    expect(button(/Pix/)).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the store refusal and goes back to the bag', async () => {
    const f = fakes()
    f.place.mockRejectedValue(new OrderRejectedError('Coxinha esgotou.'))
    const { user } = setup(f)
    await startOrder(user)
    await user.click(button('Salgados'))
    await user.click(button('Adicionar Coxinha'))
    await user.click(button('Ver pedido'))
    await user.click(button('Pagar'))

    await user.click(button('Simular aprovação (demo)'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Coxinha esgotou.')
    await user.click(button('Voltar ao pedido'))

    expect(screen.getByRole('heading', { name: 'Seu pedido' })).toBeInTheDocument()
  })

  it('shows a generic message when the order cannot be sent', async () => {
    const f = fakes()
    f.place.mockRejectedValue(new TypeError('Failed to fetch'))
    const { user } = setup(f)
    await startOrder(user)
    await user.click(button('Salgados'))
    await user.click(button('Adicionar Esfiha de carne'))
    await user.click(button('Ver pedido'))
    await user.click(button('Pagar'))

    await user.click(button('Simular aprovação (demo)'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível registrar o pedido. Tente de novo.')
  })

  it('locks the cancel button while the payment is processing', async () => {
    const f = fakes()
    f.place.mockReturnValue(new Promise(() => {}))
    const { user } = setup(f)
    await startOrder(user)
    await user.click(button('Doces'))
    await user.click(button('Adicionar Brigadeiro'))
    await user.click(button('Ver pedido'))
    await user.click(button('Pagar'))

    await user.click(button('Simular aprovação (demo)'))

    expect(screen.getByRole('status')).toHaveTextContent('Processando o pagamento...')
    expect(button('Cancelar pedido')).toBeDisabled()
  })

  it('goes back to the start without asking when the cart is empty', async () => {
    const { user } = setup()
    await startOrder(user)

    await user.click(button('Voltar ao início'))

    expect(screen.getByRole('heading', { name: 'Peça aqui. Pague aqui.' })).toBeInTheDocument()
  })

  it('asks before cancelling a cart with items', async () => {
    const { user } = setup()
    await startOrder(user)
    await user.click(button('Doces'))
    await user.click(button('Adicionar Pudim'))

    await user.click(button('Cancelar pedido'))
    expect(screen.getByText('O item escolhido será removido.')).toBeInTheDocument()
    await user.click(button('Continuar pedido'))
    expect(screen.getByText('1 item')).toBeInTheDocument()
    await user.click(button('Mais um Pudim'))
    await user.click(button('Cancelar pedido'))
    expect(screen.getByText('Os 2 itens escolhidos serão removidos.')).toBeInTheDocument()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar pedido' }))

    expect(screen.getByRole('heading', { name: 'Peça aqui. Pague aqui.' })).toBeInTheDocument()
  })

  it('asks an idle customer, then starts over when nobody answers', async () => {
    const { user } = setup()
    await startOrder(user)

    act(() => vi.advanceTimersByTime(45_000))
    expect(screen.getByRole('dialog', { name: 'Você ainda está aí?' })).toBeInTheDocument()
    await user.click(button('Continuar'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(45_000))
    expect(screen.getByText('O pedido será cancelado em 15 s.')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(15_000))

    expect(screen.getByRole('heading', { name: 'Peça aqui. Pague aqui.' })).toBeInTheDocument()
  })

  it('lets an idle customer start over right away', async () => {
    const { user } = setup()
    await startOrder(user)

    act(() => vi.advanceTimersByTime(45_000))
    await user.click(button('Recomeçar'))

    expect(screen.getByRole('heading', { name: 'Peça aqui. Pague aqui.' })).toBeInTheDocument()
  })

  it('returns to the start 20 seconds after the order number, or on tap', async () => {
    const { user } = setup()
    await startOrder(user)
    await user.click(button(COMBO_BANNER))
    await user.click(button('Ver pedido'))
    await user.click(button('Pagar'))
    await user.click(button('Simular aprovação (demo)'))
    await screen.findByText('Voltando ao início em 20 s')

    act(() => vi.advanceTimersByTime(20_000))
    expect(screen.getByRole('heading', { name: 'Peça aqui. Pague aqui.' })).toBeInTheDocument()

    await startOrder(user)
    await user.click(button(COMBO_BANNER))
    await user.click(button('Ver pedido'))
    await user.click(button('Pagar'))
    await user.click(button('Simular aprovação (demo)'))
    await user.click(await screen.findByRole('button', { name: 'Fazer novo pedido' }))
    expect(screen.getByRole('heading', { name: 'Peça aqui. Pague aqui.' })).toBeInTheDocument()
  })

  it('sends a long queue to the phone with a scannable code', async () => {
    const { user } = setup()

    await user.click(button('A fila está grande? Peça pelo celular'))
    expect(screen.getByRole('heading', { name: 'A fila está grande' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Aproxime o celular' })).toHaveTextContent('Encoste o celular no adesivo TOPA ao lado da tela.')
    expect(screen.getByRole('region', { name: 'Aponte a câmera' })).toContainElement(
      screen.getByRole('img', { name: 'Código para abrir o cardápio no celular' }),
    )
    expect(screen.getByRole('img', { name: 'Código para abrir o cardápio no celular' })).toBeInTheDocument()
    await user.click(button('Pedir no totem'))

    expect(screen.getByRole('heading', { name: 'Peça aqui. Pague aqui.' })).toBeInTheDocument()
  })

  it('shows loading, then an error with retry when the menu cannot load', async () => {
    const f = fakes()
    let fail: (reason: Error) => void = () => {}
    f.list.mockReturnValueOnce(new Promise((_, reject) => (fail = reject)))
    const { user } = setup(f)

    await user.click(button(/Comer aqui/))
    expect(screen.getByRole('status')).toHaveTextContent('Carregando o cardápio...')
    await act(async () => fail(new Error('down')))
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o cardápio.')
    await user.click(button('Tentar de novo'))

    expect(await screen.findByRole('heading', { name: 'Lanches' })).toBeInTheDocument()
  })
})
