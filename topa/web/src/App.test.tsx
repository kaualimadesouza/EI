import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'
import { createAdapters, type Runtime } from './composition'

function tapFiveTimes(text: string) {
  for (let i = 0; i < 5; i += 1) fireEvent.click(screen.getByText(text))
}

// an Android phone browser: it has the Vibration API, which the test watches
function demoOnAndroid(vibrate: () => boolean) {
  const runtime: Runtime = { tauri: false, mobile: true, totem: false, ndefReader: undefined, tagBridge: undefined, vibrate }
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
    render(<App adapters={createAdapters(undefined)} />)

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

  it('treats a store link opened from the totem as the customer phone: no queue to send away', () => {
    window.history.replaceState(null, '', '/?loja=lanchonete-bem-te-vi')
    render(<App adapters={createAdapters(undefined)} />)

    expect(screen.getByRole('heading', { name: 'Peça aqui. Pague aqui.' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'A fila está grande? Peça pelo celular' })).not.toBeInTheDocument()
  })

  it('hands the staff gesture on the kiosk mark to the role switch', () => {
    const onSwitchRole = vi.fn()
    render(<App adapters={createAdapters(undefined)} onSwitchRole={onSwitchRole} />)

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
    render(<App adapters={adapters} path="/painel" />)
    expect(await kitchenColumnOfOrder001()).toBe('Prontos')
  })

  it('in demo mode, leaves an order placed at the totem to the dashboard: it never turns ready by itself', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const vibrate = vi.fn(() => true)
    const adapters = demoOnAndroid(vibrate)
    const totem = render(<App adapters={adapters} />)

    await payForAPudim(user)
    expect(await screen.findByText('Pedido confirmado')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(10_000))

    expect(screen.queryByText(/Preparando|pronto/)).not.toBeInTheDocument()
    expect(vibrate).not.toHaveBeenCalled()
    totem.unmount()
    render(<App adapters={adapters} path="/painel" />)
    expect(await kitchenColumnOfOrder001()).toBe('Recebidos')
    expect(within(screen.getByRole('region', { name: 'Prontos' })).getByText('Nenhum pedido aqui.')).toBeInTheDocument()
  })
})
