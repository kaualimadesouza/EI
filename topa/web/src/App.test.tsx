import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'
import { createAdapters } from './composition'

function tapFiveTimes(text: string) {
  for (let i = 0; i < 5; i += 1) fireEvent.click(screen.getByText(text))
}

describe('App', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))

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
})
