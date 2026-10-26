import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App'
import { createAdapters } from './composition'

describe('App', () => {
  it('opens on the start screen wired to the configured adapters', async () => {
    render(<App adapters={createAdapters(undefined)} />)

    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1 }))
    expect(await screen.findByText('Modo demonstração')).toBeInTheDocument()
  })

  it('opens the phone app on the sticker reader instead of the kiosk', () => {
    render(<App adapters={createAdapters(undefined)} phone />)

    expect(screen.getByRole('main')).toContainElement(screen.getByRole('button', { name: 'Aproximar do totem' }))
    expect(screen.queryByText('Peça aqui. Pague aqui.')).not.toBeInTheDocument()
  })
})
