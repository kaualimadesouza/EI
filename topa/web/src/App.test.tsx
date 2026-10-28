import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { App } from './App'
import { createAdapters } from './composition'

describe('App', () => {
  it('runs the kiosk on the configured adapters with the real clock', async () => {
    const user = userEvent.setup()
    render(<App adapters={createAdapters(undefined)} onUseAsTotem={vi.fn()} />)

    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1 }))
    expect(screen.getByRole('status')).toHaveTextContent('Modo demonstração')
    await user.click(screen.getByRole('button', { name: /Comer aqui/ }))

    expect(await screen.findByRole('heading', { name: 'Lanches' })).toBeInTheDocument()
  })

  it('opens the merchant dashboard under /painel', async () => {
    render(<App adapters={createAdapters(undefined)} path="/painel" onUseAsTotem={vi.fn()} />)

    expect(await screen.findByRole('heading', { name: 'Painel do lojista' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Comer aqui/ })).not.toBeInTheDocument()
  })

  it('lets staff turn a totem back into the phone app from the kiosk start', () => {
    vi.useFakeTimers()
    const onLeaveTotem = vi.fn()
    render(<App adapters={createAdapters(undefined)} onUseAsTotem={vi.fn()} onLeaveTotem={onLeaveTotem} />)

    fireEvent.pointerDown(screen.getByText('por TOPA'))
    act(() => vi.advanceTimersByTime(3000))
    vi.useRealTimers()

    expect(onLeaveTotem).toHaveBeenCalledOnce()
  })

  it('opens the phone app on the totem reader instead of the kiosk', () => {
    vi.useFakeTimers()
    const onUseAsTotem = vi.fn()
    render(<App adapters={createAdapters(undefined)} phone onUseAsTotem={onUseAsTotem} />)

    expect(screen.getByRole('main')).toContainElement(screen.getByRole('button', { name: 'Aproximar do totem' }))
    expect(screen.queryByText('Peça aqui. Pague aqui.')).not.toBeInTheDocument()
    fireEvent.pointerDown(screen.getByText('TOPA'))
    act(() => vi.advanceTimersByTime(3000))
    vi.useRealTimers()

    expect(onUseAsTotem).toHaveBeenCalledOnce()
  })
})
