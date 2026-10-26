import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { App } from './App'
import { createAdapters } from './composition'

describe('App', () => {
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

  it('opens the phone app on the sticker reader instead of the kiosk', () => {
    render(<App adapters={createAdapters(undefined)} phone />)

    expect(screen.getByRole('main')).toContainElement(screen.getByRole('button', { name: 'Aproximar do totem' }))
    expect(screen.queryByText('Peça aqui. Pague aqui.')).not.toBeInTheDocument()
  })
})
