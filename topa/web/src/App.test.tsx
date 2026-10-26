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
})
