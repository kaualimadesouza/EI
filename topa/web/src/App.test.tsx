import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App'
import type { ConnectionPort } from './ports/connection'

const pending: ConnectionPort = { isReachable: () => new Promise<boolean>(() => {}) }

describe('App', () => {
  it('opens on the start screen in the mode the composition root picked', () => {
    render(<App adapters={{ mode: 'demo', connection: pending }} />)

    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1 }))
    expect(screen.getByRole('status')).toHaveTextContent('Modo demonstração')
  })

  it('hands the start screen the connection to check', async () => {
    const online: ConnectionPort = { isReachable: () => Promise.resolve(true) }

    render(<App adapters={{ mode: 'api', connection: online }} />)

    expect(await screen.findByText('Servidor local conectado')).toBeInTheDocument()
  })
})
