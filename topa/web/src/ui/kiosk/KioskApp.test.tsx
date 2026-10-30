import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEMO_CATALOG } from '../../domain/demo-catalog'
import type { Product } from '../../domain/menu'
import type { OrderDraft, OrderSummary, PlacedOrder } from '../../domain/order'
import { DEMO_STORE_NAME, DEMO_STORE_SLUG, type StoreMenu } from '../../domain/store'
import type { Adapters } from '../../ports/adapters'
import { StoreNotFoundError } from '../../ports/menu'
import { OrderRejectedError } from '../../ports/orders'
import { KioskApp } from './KioskApp'
import { FOLLOW_MS } from './PagerScreen'
import { Qr } from './Qr'

interface Fakes {
  adapters: Adapters
  isReachable: ReturnType<typeof vi.fn<() => Promise<boolean>>>
  place: ReturnType<typeof vi.fn<(draft: OrderDraft) => Promise<PlacedOrder>>>
  load: ReturnType<typeof vi.fn<(storeSlug: string) => Promise<StoreMenu>>>
  statusOf: ReturnType<typeof vi.fn<(orderId: string) => Promise<OrderSummary['status']>>>
  buzz: ReturnType<typeof vi.fn<() => void>>
  hold: ReturnType<typeof vi.fn<() => () => void>>
  letGo: ReturnType<typeof vi.fn<() => void>>
}

function fakes(
  products: Product[] = DEMO_CATALOG.map((p) => ({ ...p })),
  store = { slug: DEMO_STORE_SLUG, name: DEMO_STORE_NAME },
): Fakes {
  const isReachable = vi.fn<() => Promise<boolean>>().mockResolvedValue(true)
  const load = vi.fn<(storeSlug: string) => Promise<StoreMenu>>().mockResolvedValue({ store, products })
  const place = vi
    .fn<(draft: OrderDraft) => Promise<PlacedOrder>>()
    .mockImplementation((draft) =>
      Promise.resolve({ id: 'o47', number: 47, totalCents: draft.lines.length * 100 }),
    )
  const statusOf = vi.fn<(orderId: string) => Promise<OrderSummary['status']>>().mockResolvedValue('received')
  const buzz = vi.fn<() => void>()
  const letGo = vi.fn<() => void>()
  const hold = vi.fn<() => () => void>(() => letGo)
  const adapters: Adapters = {
    mode: 'demo',
    connection: { isReachable },
    menu: { load, setAvailability: vi.fn(), create: vi.fn(), update: vi.fn() },
    orders: { place, list: vi.fn(), setStatus: vi.fn(), statusOf, listCustomerOrders: vi.fn() },
    auth: {
      login: vi.fn(),
      logout: vi.fn(),
      getToken: () => null,
      getMerchant: () => null,
    },
    customerAuth: {
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      getToken: () => null,
      getCustomer: () => null,
      init: () => Promise.resolve(null),
    },
    stores: {
      listAll: () => Promise.resolve([]),
    },
    recommendations: {
      getRecommendations: vi.fn().mockResolvedValue({ items: [], strategyUsed: 'popular_fallback', abGroup: 'control' }),
    },
    voice: {
      isSupported: () => true,
      startListening: vi.fn().mockReturnValue(() => {}),
    },
    nfc: { scan: () => Promise.resolve({ kind: 'no-nfc' as const }) },
    tag: { available: false, publish: vi.fn(), withdraw: vi.fn() },
    buzzer: { buzz },
    wakeLock: { hold },
  }
  return { adapters, isReachable, place, load, statusOf, buzz, hold, letGo }
}

const PHONE_MENU_URL = 'https://topa-totem.vercel.app/?loja=lanchonete-bem-te-vi'

const morning = () => new Date(2026, 9, 26, 8, 0)

function setup(f: Fakes = fakes(), now: () => Date = morning) {
  const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
  render(<KioskApp adapters={f.adapters} now={now} storeSlug={DEMO_STORE_SLUG} surface="totem" />)
  return { user, ...f }
}

// the kiosk opened on the customer's own phone: the phone app, or a store link in its browser
function setupPhone(f: Fakes = fakes(), storeSlug = 'cantina-central') {
  const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
  render(<KioskApp adapters={f.adapters} now={morning} storeSlug={storeSlug} surface="phone" />)
  return { user, ...f }
}

const button = (name: string | RegExp) => screen.getByRole('button', { name })
// role queries match accessible names verbatim, and Intl puts a no-break space after R$
const COMBO_BANNER = 'Adicionar Café + pão de queijo por R$\u00a012,90'

async function startOrder(user: ReturnType<typeof userEvent.setup>, dineIn = true) {
  await user.click(button(dineIn ? /Comer aqui/ : /Levar para viagem/))
  await screen.findByRole('heading', { name: 'Lanches' })
}

async function payForCombo(user: ReturnType<typeof userEvent.setup>) {
  await startOrder(user)
  await user.click(button(COMBO_BANNER))
  await user.click(button('Ver pedido'))
  await user.click(button('Pagar'))
  await user.click(button('Simular aprovação (demo)'))
}

const nextCheck = () => act(() => vi.advanceTimersByTimeAsync(FOLLOW_MS))

const UPDATE_FAILED = 'Não foi possível atualizar o pedido. Se demorar, procure o balcão.'

// the lock screen or another app hides the page; coming back shows it again
async function showPage(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

describe('KioskApp', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    vi.useRealTimers()
    Reflect.deleteProperty(document, 'visibilityState')
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
      storeSlug: 'lanchonete-bem-te-vi',
      lines: [{ productId: 'combo-cafe', quantity: 1 }],
      dineIn: false,
      paymentMethod: 'card',
    })
  })

  it('on the totem, keeps the plain confirmation: no kitchen to follow, nothing buzzes', async () => {
    const { user, statusOf, buzz, hold } = setup()

    await payForCombo(user)
    await screen.findByText('Pedido confirmado')
    act(() => vi.advanceTimersByTime(15_000))

    expect(screen.getByText('Acompanhe seu número na tela do balcão.')).toBeInTheDocument()
    expect(screen.queryByText(/Preparando|pronto/)).not.toBeInTheDocument()
    expect(statusOf).not.toHaveBeenCalled()
    expect(buzz).not.toHaveBeenCalled()
    expect(hold).not.toHaveBeenCalled()
  })

  it('on the customer phone, shows the order being prepared, then buzzes and calls the customer when it is ready', async () => {
    const { user, statusOf, buzz } = setupPhone()

    await payForCombo(user)
    expect(await screen.findByRole('status')).toHaveTextContent('Preparando seu pedido')
    expect(screen.getByLabelText('Pedido número 047')).toBeInTheDocument()
    expect(screen.getByText('Avisamos aqui quando ficar pronto. Deixe esta tela aberta.')).toBeInTheDocument()
    await nextCheck()
    expect(statusOf).toHaveBeenLastCalledWith('o47')
    expect(screen.getByRole('status')).toHaveTextContent('Preparando seu pedido')
    expect(buzz).not.toHaveBeenCalled()

    statusOf.mockResolvedValue('ready')
    await nextCheck()

    expect(screen.getByRole('status')).toHaveTextContent('Seu pedido está pronto')
    expect(screen.getByText('Retire no balcão.')).toBeInTheDocument()
    expect(screen.getByLabelText('Pedido número 047')).toBeInTheDocument()
    expect(buzz).toHaveBeenCalledOnce()
  })

  it('keeps the phone on a ready order until the customer leaves, buzzing once per call', async () => {
    const f = fakes()
    f.statusOf.mockResolvedValue('ready')
    const { user, buzz } = setupPhone(f)
    await payForCombo(user)
    await screen.findByRole('status')

    act(() => vi.advanceTimersByTime(60_000))
    await nextCheck()

    expect(screen.getByRole('status')).toHaveTextContent('Seu pedido está pronto')
    expect(buzz).toHaveBeenCalledOnce()
    await user.click(button('Fazer novo pedido'))
    expect(screen.getByRole('heading', { name: 'Peça aqui. Pague aqui.' })).toBeInTheDocument()
  })

  it('goes back to preparing when the counter undoes ready, and buzzes again when it is ready once more', async () => {
    const { user, statusOf, buzz } = setupPhone()
    await payForCombo(user)
    await screen.findByRole('status')

    statusOf.mockResolvedValue('ready')
    await nextCheck()
    statusOf.mockResolvedValue('preparing')
    await nextCheck()
    expect(screen.getByRole('status')).toHaveTextContent('Preparando seu pedido')
    statusOf.mockResolvedValue('ready')
    await nextCheck()

    expect(screen.getByRole('status')).toHaveTextContent('Seu pedido está pronto')
    expect(buzz).toHaveBeenCalledTimes(2)
  })

  it('warns when a check fails, keeps the last known state, and clears the warning once it gets through', async () => {
    const { user, statusOf } = setupPhone()
    await payForCombo(user)
    await screen.findByRole('status')

    statusOf.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await nextCheck()
    expect(screen.getByRole('alert')).toHaveTextContent(UPDATE_FAILED)
    expect(screen.getByRole('status')).toHaveTextContent('Preparando seu pedido')
    statusOf.mockResolvedValue('ready')
    await nextCheck()

    expect(screen.getByRole('status')).toHaveTextContent('Seu pedido está pronto')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps following a handed-over order, so an undo at the counter calls the customer again', async () => {
    const { user, statusOf, buzz } = setupPhone()
    await payForCombo(user)
    await screen.findByRole('status')

    statusOf.mockResolvedValue('delivered')
    await nextCheck()
    expect(screen.getByRole('status')).toHaveTextContent('Pedido entregue')
    expect(screen.getByText('Obrigado pela preferência.')).toBeInTheDocument()
    statusOf.mockResolvedValue('ready')
    await nextCheck()

    expect(screen.getByRole('status')).toHaveTextContent('Seu pedido está pronto')
    expect(buzz).toHaveBeenCalledOnce()
  })

  it('asks one question at a time, so a slow answer can never land after a newer one', async () => {
    const { user, statusOf } = setupPhone()
    await payForCombo(user)
    await screen.findByRole('status')
    let answer: (status: OrderSummary['status']) => void = () => {}
    statusOf.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))

    await nextCheck()
    await nextCheck()
    await showPage('visible')
    await nextCheck()
    expect(statusOf).toHaveBeenCalledOnce()
    await act(async () => answer('ready'))
    expect(screen.getByRole('status')).toHaveTextContent('Seu pedido está pronto')
    await nextCheck()

    expect(statusOf).toHaveBeenCalledTimes(2)
  })

  it('asks at once when the customer comes back to the screen, and not while it is hidden', async () => {
    const { user, statusOf } = setupPhone()
    await payForCombo(user)
    await screen.findByRole('status')
    statusOf.mockResolvedValue('ready')

    await showPage('hidden')
    expect(statusOf).not.toHaveBeenCalled()
    await showPage('visible')

    expect(statusOf).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('Seu pedido está pronto')
  })

  it('keeps the screen on while the customer waits, and lets it sleep once the order is handed over', async () => {
    const { user, statusOf, hold, letGo } = setupPhone()
    await payForCombo(user)
    await screen.findByRole('status')
    expect(hold).toHaveBeenCalledOnce()

    statusOf.mockResolvedValue('delivered')
    await nextCheck()
    expect(letGo).toHaveBeenCalledOnce()
    statusOf.mockResolvedValue('ready')
    await nextCheck()
    expect(hold).toHaveBeenCalledTimes(2)
    await user.click(button('Fazer novo pedido'))

    expect(letGo).toHaveBeenCalledTimes(2)
  })

  it('stops asking once the customer leaves the order screen, even with a check still out', async () => {
    const { user, statusOf } = setupPhone()
    await payForCombo(user)
    await screen.findByRole('status')
    let answer: (status: OrderSummary['status']) => void = () => {}
    statusOf.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
    await nextCheck()

    await user.click(button('Fazer novo pedido'))
    await act(async () => answer('ready'))
    await nextCheck()

    expect(statusOf).toHaveBeenCalledOnce()
    expect(screen.getByRole('heading', { name: 'Peça aqui. Pague aqui.' })).toBeInTheDocument()
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

  it('displays recommendations in the bag and adds them to the order', async () => {
    const { user, adapters } = setup()
    adapters.recommendations.getRecommendations = vi.fn().mockResolvedValue({
      items: [
        {
          productId: 'suco',
          name: 'Suco de Laranja',
          priceCents: 800,
          category: 'bebidas',
          score: 0.95,
          reason: 'Combina com seu lanche.',
        },
      ],
      strategyUsed: 'association_rules',
      abGroup: 'treatment',
    })

    await startOrder(user)
    await user.click(button('Adicionar Bauru'))
    await user.click(button('Não, obrigado'))
    await user.click(button('Ver pedido'))

    expect(await screen.findByText('Complete seu pedido')).toBeInTheDocument()
    expect(screen.getByText('Suco de Laranja')).toBeInTheDocument()
    expect(screen.getByText('Combina com seu lanche.')).toBeInTheDocument()

    await user.click(button('Adicionar Suco de Laranja'))
    expect(screen.getByText('Total, 2 itens')).toBeInTheDocument()
  })

  it('handles recommendation failure gracefully in the bag', async () => {
    const { user, adapters } = setup()
    adapters.recommendations.getRecommendations = vi.fn().mockRejectedValue(new Error('Network error'))

    await startOrder(user)
    await user.click(button('Adicionar Bauru'))
    await user.click(button('Não, obrigado'))
    await user.click(button('Ver pedido'))

    expect(screen.getByText('Seu pedido')).toBeInTheDocument()
    expect(screen.queryByText('Complete seu pedido')).not.toBeInTheDocument()
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

  it('waits for a Pix payment as long as the code is valid before asking', async () => {
    const { user } = setup()
    await startOrder(user)
    await user.click(button('Adicionar Misto quente'))
    await user.click(button('Não, obrigado'))
    await user.click(button('Ver pedido'))
    await user.click(button('Pagar'))
    await user.click(button('Pix'))

    act(() => vi.advanceTimersByTime(299_000))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Código Pix de demonstração')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1_000))

    expect(screen.getByRole('dialog', { name: 'Você ainda está aí?' })).toBeInTheDocument()
  })

  it('does not push the idle question past the Pix code when the screen is touched meanwhile', async () => {
    const { user } = setup()
    await startOrder(user)
    await user.click(button('Adicionar Misto quente'))
    await user.click(button('Não, obrigado'))
    await user.click(button('Ver pedido'))
    await user.click(button('Pagar'))
    await user.click(button('Pix'))

    act(() => vi.advanceTimersByTime(100_000))
    await user.click(screen.getByLabelText('Código Pix de demonstração'))
    act(() => vi.advanceTimersByTime(200_000))

    expect(screen.getByRole('dialog', { name: 'Você ainda está aí?' })).toBeInTheDocument()
  })

  it('sends the customer back to the menu when every line sold out during the order', async () => {
    const f = fakes()
    f.place.mockRejectedValue(new OrderRejectedError('Coxinha esgotou.'))
    const { user } = setup(f)
    await startOrder(user)
    await user.click(button('Salgados'))
    await user.click(button('Adicionar Coxinha'))
    f.load.mockResolvedValue({
      store: { slug: DEMO_STORE_SLUG, name: DEMO_STORE_NAME },
      products: DEMO_CATALOG.map((p) => ({ ...p, available: p.id !== 'coxinha' })),
    })
    await user.click(button('Ver pedido'))
    await user.click(button('Pagar'))

    await user.click(button('Simular aprovação (demo)'))

    expect(await screen.findByRole('button', { name: 'Coxinha, esgotado' })).toBeDisabled()
    expect(screen.getByText('Toque em um produto para adicionar.')).toBeInTheDocument()
  })

  it('still starts over when a customer leaves the cancel question unanswered', async () => {
    const { user } = setup()
    await startOrder(user)
    await user.click(button('Doces'))
    await user.click(button('Adicionar Pudim'))
    await user.click(button('Cancelar pedido'))

    act(() => vi.advanceTimersByTime(45_000))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'Você ainda está aí?' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(15_000))

    expect(screen.getByRole('heading', { name: 'Peça aqui. Pague aqui.' })).toBeInTheDocument()
  })

  it('swaps an unanswered suggestion for the idle question instead of stacking them', async () => {
    const { user } = setup()
    await startOrder(user)
    await user.click(button('Adicionar X-salada'))

    act(() => vi.advanceTimersByTime(45_000))

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'Você ainda está aí?' })).toBeInTheDocument()
  })

  it('takes a product that sold out during the order off the bag and the menu', async () => {
    const f = fakes()
    f.place.mockRejectedValue(new OrderRejectedError('Coxinha esgotou.'))
    const { user } = setup(f)
    await startOrder(user)
    await user.click(button('Salgados'))
    await user.click(button('Adicionar Coxinha'))
    await user.click(button('Adicionar Pão de queijo'))
    f.load.mockResolvedValue({
      store: { slug: DEMO_STORE_SLUG, name: DEMO_STORE_NAME },
      products: DEMO_CATALOG.map((p) => ({ ...p, available: p.id !== 'coxinha' })),
    })
    await user.click(button('Ver pedido'))
    await user.click(button('Pagar'))

    await user.click(button('Simular aprovação (demo)'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Coxinha esgotou.')
    await user.click(button('Voltar ao pedido'))

    expect(screen.getByText('Total, 1 item')).toBeInTheDocument()
    expect(screen.queryByText('Coxinha')).not.toBeInTheDocument()
    await user.click(button('Continuar comprando'))
    expect(button('Coxinha, esgotado')).toBeDisabled()
  })

  it('still shows the rejection when the menu cannot be refreshed after it', async () => {
    const f = fakes()
    f.place.mockRejectedValue(new OrderRejectedError('Coxinha esgotou.'))
    const { user } = setup(f)
    await startOrder(user)
    await user.click(button('Salgados'))
    await user.click(button('Adicionar Coxinha'))
    f.load.mockRejectedValue(new Error('offline'))
    await user.click(button('Ver pedido'))
    await user.click(button('Pagar'))

    await user.click(button('Simular aprovação (demo)'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Coxinha esgotou.')
    await user.click(button('Voltar ao pedido'))
    expect(screen.getByText('Total, 1 item')).toBeInTheDocument()
  })

  it('stops at 20 units of a product, as the store does', async () => {
    const { user } = setup()
    await startOrder(user)
    await user.click(button('Doces'))
    await user.click(button('Adicionar Pudim'))
    for (let i = 1; i < 20; i++) await user.click(button('Mais um Pudim'))

    expect(screen.getByLabelText('20 no pedido')).toBeInTheDocument()
    expect(button('Mais um Pudim')).toBeDisabled()
    await user.click(button('Ver pedido'))
    expect(button('Mais um Pudim')).toBeDisabled()
    expect(screen.getByText('Total, 20 itens')).toBeInTheDocument()
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
    const qr = screen.getByRole('img', { name: 'Código para abrir o cardápio no celular' })
    expect(screen.getByRole('region', { name: 'Aponte a câmera' })).toContainElement(qr)
    const { container } = render(<Qr value={PHONE_MENU_URL} size={200} label="expected" />)
    expect(qr.querySelector('path')?.getAttribute('d')).toBe(container.querySelector('path')?.getAttribute('d'))
    await user.click(button('Pedir no totem'))

    expect(screen.getByRole('heading', { name: 'Peça aqui. Pague aqui.' })).toBeInTheDocument()
  })

  it('serves the phone menu link as its own NFC tag on the start and queue screens only', async () => {
    const f = fakes()
    const tag = { available: true, publish: vi.fn(), withdraw: vi.fn() }
    const { user } = setup({ ...f, adapters: { ...f.adapters, tag } })

    expect(tag.publish).toHaveBeenLastCalledWith(PHONE_MENU_URL)
    await user.click(button('A fila está grande? Peça pelo celular'))
    expect(screen.getByRole('region', { name: 'Aproxime o celular' })).toHaveTextContent('Encoste o celular atrás do totem.')
    await user.click(button('Pedir no totem'))
    expect(tag.withdraw).not.toHaveBeenCalled()
    await startOrder(user)

    // the payment screen asks for a card on the same spot, so the tag must be gone by then
    expect(tag.withdraw).toHaveBeenCalledOnce()
    expect(tag.publish).toHaveBeenCalledOnce()
  })

  it('on the customer phone it serves no tag, offers no queue and shows no server status pill', () => {
    const f = fakes()
    const tag = { available: true, publish: vi.fn(), withdraw: vi.fn() }
    render(<KioskApp adapters={{ ...f.adapters, tag }} now={morning} storeSlug="cantina-central" surface="phone" />)

    expect(tag.publish).not.toHaveBeenCalled()
    expect(f.isReachable).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'A fila está grande? Peça pelo celular' })).not.toBeInTheDocument()
  })

  it('on the customer phone loads the scanned store, never times out on inactivity, and pays with Pix without asking to tap the totem', async () => {
    const cantina = fakes(
      DEMO_CATALOG.map((p) => ({ ...p })),
      { slug: 'cantina-central', name: 'Cantina Central' },
    )
    const { user, load, place } = setupPhone(cantina, 'cantina-central')

    expect(await screen.findByText('Cantina Central')).toBeInTheDocument()
    expect(load).toHaveBeenCalledWith('cantina-central')
    await startOrder(user)
    expect(screen.getByText('Cantina Central')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(120_000))
    expect(screen.queryByRole('dialog', { name: 'Você ainda está aí?' })).not.toBeInTheDocument()

    await user.click(button(COMBO_BANNER))
    await user.click(button('Ver pedido'))
    await user.click(button('Pagar'))

    expect(screen.getByRole('heading', { name: 'Pague com Pix' })).toBeInTheDocument()
    expect(screen.getByText('Copie o código Pix e pague no app do seu banco.')).toBeInTheDocument()
    expect(screen.queryByText(/Cartão ou celular/)).not.toBeInTheDocument()
    expect(screen.queryByText(/atrás do totem|atrás da tela/)).not.toBeInTheDocument()

    await user.click(button('Copiar código Pix'))
    expect(await navigator.clipboard.readText()).toBe('TOPA-PIX-DEMO-1290-0')
    expect(button('Código copiado')).toBeInTheDocument()

    await user.click(button('Simular recusa (demo)'))
    expect(screen.getByRole('alert')).toHaveTextContent('Pagamento não confirmado. Tente de novo.')
    expect(screen.queryByRole('button', { name: 'Pagar com Pix' })).not.toBeInTheDocument()
    await user.click(button('Tentar de novo'))

    await user.click(button('Simular aprovação (demo)'))
    expect(place).toHaveBeenCalledWith({
      storeSlug: 'cantina-central',
      lines: [{ productId: 'combo-cafe', quantity: 1 }],
      dineIn: true,
      paymentMethod: 'pix',
    })
  })

  it('shows the Pix code as plain text when the browser blocks clipboard access', async () => {
    const { user } = setupPhone()
    await startOrder(user)
    await user.click(button(COMBO_BANNER))
    await user.click(button('Ver pedido'))
    await user.click(button('Pagar'))
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('blocked'))

    await user.click(button('Copiar código Pix'))

    expect(await screen.findByText('TOPA-PIX-DEMO-1290-0')).toBeInTheDocument()
    await user.click(button('Copiar código Pix'))
    expect(await screen.findByRole('button', { name: 'Código copiado' })).toBeInTheDocument()
    expect(screen.queryByText('TOPA-PIX-DEMO-1290-0')).not.toBeInTheDocument()
  })

  it('shows the Pix code as plain text where the browser has no clipboard, as over plain http', async () => {
    const { user } = setupPhone()
    await startOrder(user)
    await user.click(button(COMBO_BANNER))
    await user.click(button('Ver pedido'))
    await user.click(button('Pagar'))
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })

    try {
      await user.click(button('Copiar código Pix'))
      expect(screen.getByText('TOPA-PIX-DEMO-1290-0')).toBeInTheDocument()
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  it('tells the customer when the store in the link does not exist', async () => {
    const f = fakes()
    f.load.mockRejectedValueOnce(new StoreNotFoundError('Loja não encontrada.'))
    setupPhone(f, 'loja-inexistente')

    expect(await screen.findByRole('heading', { name: 'Loja não encontrada' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Comer aqui/ })).not.toBeInTheDocument()
  })

  it('stops serving the tag when the kiosk closes', () => {
    const { adapters } = fakes()
    const { unmount } = render(<KioskApp adapters={adapters} now={morning} storeSlug={DEMO_STORE_SLUG} surface="totem" />)

    unmount()

    expect(adapters.tag.withdraw).toHaveBeenCalled()
  })

  it('shows loading, then an error with retry when the menu cannot load', async () => {
    const f = fakes()
    let fail: (reason: Error) => void = () => {}
    f.load.mockReturnValueOnce(new Promise((_, reject) => (fail = reject)))
    const { user } = setup(f)

    await user.click(button(/Comer aqui/))
    expect(screen.getByText('TOPA')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Carregando o cardápio...')
    await act(async () => fail(new Error('down')))
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o cardápio.')
    await user.click(button('Tentar de novo'))

    expect(await screen.findByRole('heading', { name: 'Lanches' })).toBeInTheDocument()
  })
  it('on a totem whose store is missing, offers a retry, keeps the staff gesture and serves no tag', async () => {
    const f = fakes()
    const tag = { available: true, publish: vi.fn(), withdraw: vi.fn() }
    const onSwitchRole = vi.fn()
    f.load.mockRejectedValueOnce(new StoreNotFoundError())
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
    render(
      <KioskApp
        adapters={{ ...f.adapters, tag }}
        now={morning}
        storeSlug={DEMO_STORE_SLUG}
        surface="totem"
        onSwitchRole={onSwitchRole}
      />,
    )

    expect(await screen.findByRole('heading', { name: 'Loja não encontrada' })).toBeInTheDocument()
    expect(screen.getByText('Este totem não está ligado a uma loja cadastrada. Chame o suporte do TOPA.')).toBeInTheDocument()
    await waitFor(() => expect(tag.withdraw).toHaveBeenCalledTimes(tag.publish.mock.calls.length))
    for (let i = 0; i < 5; i += 1) fireEvent.click(screen.getByText('por TOPA'))
    expect(onSwitchRole).toHaveBeenCalledOnce()
    await user.click(button('Tentar de novo'))

    expect(await screen.findByRole('heading', { name: 'Peça aqui. Pague aqui.' })).toBeInTheDocument()
  })

  it('keeps the newest menu when an older refresh answers late', async () => {
    const f = fakes()
    f.place.mockRejectedValue(new OrderRejectedError('Coxinha esgotou.'))
    const { user } = setup(f)
    await startOrder(user)
    await user.click(button('Salgados'))
    await user.click(button('Adicionar Coxinha'))
    let answerRefresh: (menu: StoreMenu) => void = () => {}
    f.load.mockReturnValueOnce(new Promise((resolve) => (answerRefresh = resolve)))
    await user.click(button('Ver pedido'))
    await user.click(button('Pagar'))
    await user.click(button('Simular aprovação (demo)'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Coxinha esgotou.')
    await user.click(button('Voltar ao pedido'))
    await user.click(button('Cancelar pedido'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar pedido' }))
    await startOrder(user)

    await act(async () =>
      answerRefresh({
        store: { slug: DEMO_STORE_SLUG, name: DEMO_STORE_NAME },
        products: DEMO_CATALOG.map((p) => ({ ...p, available: p.id !== 'coxinha' })),
      }),
    )
    await user.click(button('Salgados'))

    expect(button('Adicionar Coxinha')).toBeEnabled()
  })

  it('keeps a menu that loaded when an older load fails late', async () => {
    const f = fakes()
    let failFirst: (reason: Error) => void = () => {}
    f.load.mockReturnValueOnce(new Promise((_, reject) => (failFirst = reject)))
    const { user } = setup(f)
    await user.click(button(/Comer aqui/))
    expect(screen.getByRole('status')).toHaveTextContent('Carregando o cardápio...')
    await user.click(button('Voltar ao início'))

    await act(async () => failFirst(new Error('timeout')))
    await startOrder(user)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows only the categories the store sells, starting at the first one', async () => {
    const products = DEMO_CATALOG.filter((p) => p.category === 'salgados' || p.category === 'bebidas').map((p) => ({ ...p }))
    const { user } = setupPhone(fakes(products, { slug: 'cantina-central', name: 'Cantina Central' }))

    await user.click(await screen.findByRole('button', { name: /Comer aqui/ }))

    expect(await screen.findByRole('heading', { name: 'Salgados' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Categorias' })
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['Salgados', 'Bebidas'])
    expect(button('Adicionar Coxinha')).toBeEnabled()
  })

  it('allows adding items to order via voice ordering modal', async () => {
    let transcriptCb: (text: string, isFinal: boolean) => void = () => {}
    const f = fakes()
    f.adapters.voice = {
      isSupported: () => true,
      startListening: (onTranscript) => {
        transcriptCb = onTranscript
        return vi.fn()
      },
    }
    const { user } = setup(f)
    await startOrder(user)

    await user.click(screen.getByRole('button', { name: 'Pedir por voz' }))
    const dialog = screen.getByRole('dialog', { name: 'Fazer pedido por voz' })
    expect(dialog).toBeInTheDocument()

    act(() => {
      transcriptCb('quero dois mistos quentes', true)
    })

    expect(within(dialog).getByText('Misto quente')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^Adicionar/i }))

    expect(screen.queryByRole('dialog', { name: 'Fazer pedido por voz' })).not.toBeInTheDocument()
    if (screen.queryByRole('button', { name: 'Não, obrigado' })) {
      await user.click(screen.getByRole('button', { name: 'Não, obrigado' }))
    }
    expect(screen.getByRole('button', { name: 'Ver pedido' })).toBeEnabled()
  })
})
