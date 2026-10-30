import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'
import { LocalAuth } from './adapters/local/local-auth'
import { createAdapters, type Runtime } from './composition'

function tapFiveTimes(text: string) {
  for (let i = 0; i < 5; i += 1) fireEvent.click(screen.getByText(text))
}

// an Android phone browser: it has the Vibration API, which the test watches
function demoOnAndroid(vibrate: () => boolean) {
  const runtime: Runtime = {
    tauri: false,
    mobile: true,
    flavor: 'cliente',
    storeRole: 'totem',
    totem: false,
    ndefReader: undefined,
    tagBridge: undefined,
    vibrate,
    wakeLock: undefined,
  }
  return createAdapters(undefined, runtime)
}

async function payForAPudim(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Comer aqui/ }))
  await user.click(await screen.findByRole('button', { name: 'Doces' }))
  await user.click(screen.getByRole('button', { name: 'Adicionar Pudim' }))
  await user.click(screen.getByRole('button', { name: 'Ver pedido' }))
  await user.click(screen.getByRole('button', { name: 'Pagar' }))
  await user.click(screen.getByRole('button', { name: 'Simular aprovação (demo)' }))
}

async function kitchenColumnOfOrder001() {
  const card = await screen.findByRole('article', { name: 'Pedido 001' })
  return card.closest('section')!.getAttribute('aria-label')
}

describe('App', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
    vi.useRealTimers()
    localStorage.clear()
  })

  it('runs the kiosk on the configured adapters with the real clock', async () => {
    const user = userEvent.setup()
    render(<App adapters={createAdapters(undefined)} totem />)

    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1 }))
    expect(screen.getByRole('status')).toHaveTextContent('Modo demonstração')
    await user.click(screen.getByRole('button', { name: /Comer aqui/ }))

    expect(await screen.findByRole('heading', { name: 'Lanches' })).toBeInTheDocument()
  })

  it('opens the merchant dashboard under /painel', async () => {
    render(<App adapters={createAdapters(undefined)} path="/painel" />)

    expect(await screen.findByRole('heading', { name: 'Painel do lojista' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Comer aqui/ })).not.toBeInTheDocument()
  })

  it('treats a store link opened from the totem as the customer phone: shows sold-out items from the dashboard and no server pill', async () => {
    const user = userEvent.setup()
    const adapters = createAdapters(undefined)
    await adapters.auth.login({ email: 'admin@bemtevi.topa.com', password: 'topa123' })
    const dashboard = render(<App adapters={adapters} path="/painel" />)
    await user.click(await screen.findByRole('switch', { name: 'Coxinha à venda' }))
    dashboard.unmount()

    window.history.replaceState(null, '', '/?loja=lanchonete-bem-te-vi')
    render(<App adapters={adapters} />)

    expect(screen.getByRole('heading', { name: 'Peça aqui. Pague aqui.' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'A fila está grande? Peça pelo celular' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Comer aqui/ }))
    await user.click(await screen.findByRole('button', { name: 'Salgados' }))
    expect(screen.getByRole('button', { name: 'Coxinha, esgotado' })).toBeDisabled()
  })

  it('opens the dashboard of the store named in the address', async () => {
    const base = createAdapters(undefined)
    const load = vi.fn((slug: string) => Promise.resolve({ store: { slug, name: 'Cantina Central' }, products: [] }))
    const list = vi.fn(() => Promise.resolve([]))
    window.history.replaceState(null, '', '/painel?loja=cantina-central')

    render(
      <App
        adapters={{
          ...base,
          auth: new LocalAuth({
            storage: null,
            initialMerchant: { email: 'admin@bemtevi.topa.com', storeSlug: 'cantina-central' },
            initialToken: 'token',
          }),
          menu: { load, setAvailability: vi.fn(), create: vi.fn(), update: vi.fn() },
          orders: { place: vi.fn(), list, setStatus: vi.fn(), statusOf: vi.fn() },
        }}
        path="/painel"
      />,
    )

    expect(await screen.findByText('Cantina Central')).toBeInTheDocument()
    expect(load).toHaveBeenCalledWith('cantina-central')
    expect(list).toHaveBeenCalledWith(expect.any(String), 'cantina-central')
  })

  it('refuses a broken store in the address instead of opening the demo store', () => {
    const adapters = createAdapters(undefined)
    window.history.replaceState(null, '', '/?loja=Cantina')
    const kiosk = render(<App adapters={adapters} />)

    expect(screen.getByRole('heading', { name: 'Loja não encontrada' })).toBeInTheDocument()
    expect(screen.getByText('Confira o endereço ou aproxime o celular novamente do totem.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Comer aqui/ })).not.toBeInTheDocument()
    kiosk.unmount()

    window.history.replaceState(null, '', '/painel?loja=Cantina')
    render(<App adapters={adapters} path="/painel" />)

    expect(screen.getByText('Confira o identificador da loja no endereço do painel.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Painel do lojista' })).not.toBeInTheDocument()
  })

  it('hands the staff gesture on the kiosk mark to the role switch', () => {
    const onSwitchRole = vi.fn()
    render(<App adapters={createAdapters(undefined)} totem onSwitchRole={onSwitchRole} />)

    tapFiveTimes('por TOPA')

    expect(onSwitchRole).toHaveBeenCalledOnce()
  })

  it('opens the phone app on the totem reader instead of the kiosk, with the same staff gesture', () => {
    const onSwitchRole = vi.fn()
    render(<App adapters={createAdapters(undefined)} phone onSwitchRole={onSwitchRole} />)

    expect(screen.getByRole('main')).toContainElement(screen.getByRole('button', { name: 'Aproximar do totem' }))
    expect(screen.queryByText('Peça aqui. Pague aqui.')).not.toBeInTheDocument()
    tapFiveTimes('TOPA')

    expect(onSwitchRole).toHaveBeenCalledOnce()
  })

  it('in demo mode, pages the phone that ordered 5 s after payment, and the dashboard sees the order ready', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const vibrate = vi.fn(() => true)
    const adapters = demoOnAndroid(vibrate)
    window.history.replaceState(null, '', '/?loja=lanchonete-bem-te-vi')
    const phone = render(<App adapters={adapters} />)

    await payForAPudim(user)
    expect(await screen.findByRole('status')).toHaveTextContent('Preparando seu pedido')
    await act(() => vi.advanceTimersByTimeAsync(4_000))
    expect(screen.getByRole('status')).toHaveTextContent('Preparando seu pedido')
    expect(vibrate).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(2_000))

    expect(screen.getByRole('status')).toHaveTextContent('Seu pedido está pronto')
    expect(vibrate).toHaveBeenCalledOnce()
    phone.unmount()
    await adapters.auth.login({ email: 'admin@bemtevi.topa.com', password: 'topa123' })
    render(<App adapters={adapters} path="/painel" />)
    expect(await kitchenColumnOfOrder001()).toBe('Prontos')
  })

  it('in demo mode, leaves an order placed at the totem to the dashboard: it never turns ready by itself', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const vibrate = vi.fn(() => true)
    const adapters = demoOnAndroid(vibrate)
    const totem = render(<App adapters={adapters} totem />)

    await payForAPudim(user)
    expect(await screen.findByText('Pedido confirmado')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(10_000))

    expect(screen.queryByText(/Preparando|pronto/)).not.toBeInTheDocument()
    expect(vibrate).not.toHaveBeenCalled()
    totem.unmount()
    await adapters.auth.login({ email: 'admin@bemtevi.topa.com', password: 'topa123' })
    render(<App adapters={adapters} path="/painel" />)
    expect(await kitchenColumnOfOrder001()).toBe('Recebidos')
    expect(within(screen.getByRole('region', { name: 'Prontos' })).getByText('Nenhum pedido aqui.')).toBeInTheDocument()
  })

  it('opens the merchant dashboard in store app when storeRole is painel regardless of path', async () => {
    const onSwitchRole = vi.fn()
    const adapters = createAdapters(undefined)
    await adapters.auth.login({ email: 'admin@bemtevi.topa.com', password: 'topa123' })
    render(<App adapters={adapters} storeRole="painel" onSwitchRole={onSwitchRole} />)

    expect(await screen.findByRole('heading', { name: 'Painel do lojista' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Comer aqui/ })).not.toBeInTheDocument()

    const switchBtns = screen.getAllByRole('button', { name: 'Abrir o totem' })
    fireEvent.click(switchBtns[0])
    expect(onSwitchRole).toHaveBeenCalledOnce()
  })

  it('opens the customer phone app directly without switch gesture', () => {
    render(<App adapters={createAdapters(undefined)} phone={true} />)

    expect(screen.getByRole('heading', { name: 'Peça pelo celular.' })).toBeInTheDocument()
    tapFiveTimes('TOPA')
    expect(screen.getByRole('heading', { name: 'Peça pelo celular.' })).toBeInTheDocument()
  })

  it('requires customer login on direct web access without QR code, then allows selecting store', async () => {
    const user = userEvent.setup()
    const adapters = createAdapters(undefined)

    render(<App adapters={adapters} />)

    expect(screen.getByRole('heading', { name: 'Acesse sua conta TOPA' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('E-mail'), 'cliente@topa.com')
    await user.type(screen.getByLabelText('Senha'), 'topa123')
    await user.click(screen.getByRole('button', { name: 'Entrar no TOPA' }))

    expect(await screen.findByRole('heading', { name: 'Onde você quer pedir hoje?' })).toBeInTheDocument()
    expect(screen.getByText('Olá, Cliente Universitário')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Pedir em Brasa Burgers' }))
    expect(await screen.findByRole('button', { name: /Comer aqui/ })).toBeInTheDocument()
  })

  it('allows logging out from store selector screen', async () => {
    const user = userEvent.setup()
    const adapters = createAdapters(undefined)
    await adapters.customerAuth.login({ email: 'cliente@topa.com', password: 'topa123' })

    render(<App adapters={adapters} />)

    expect(await screen.findByRole('heading', { name: 'Onde você quer pedir hoje?' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sair da conta' }))
    expect(await screen.findByRole('heading', { name: 'Acesse sua conta TOPA' })).toBeInTheDocument()
  })

  it('bypasses mandatory login when accessing through QR code deep link', async () => {
    const adapters = createAdapters(undefined)
    window.history.replaceState(null, '', '/?loja=brasa-burgers')

    render(<App adapters={adapters} />)

    expect(screen.queryByRole('heading', { name: 'Acesse sua conta TOPA' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Peça aqui. Pague aqui.' })).toBeInTheDocument()
  })
})
