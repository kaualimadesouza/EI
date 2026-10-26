import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Connection, ConnectionPort } from '../ports/connection'
import { StartScreen } from './StartScreen'

function portAnswering(connection: Connection): ConnectionPort {
  return { check: () => Promise.resolve(connection) }
}

const pending: ConnectionPort = { check: () => new Promise<Connection>(() => {}) }

describe('StartScreen', () => {
  it('greets the customer with the store and the headline', () => {
    render(<StartScreen connection={pending} />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Peça aqui. Pague aqui.')
    expect(screen.getByText('Lanchonete Bem-te-vi')).toBeInTheDocument()
    expect(screen.getByText('por TOPA')).toBeInTheDocument()
  })

  it('says it is checking while the connection has not answered', () => {
    render(<StartScreen connection={pending} />)

    expect(screen.getByRole('status')).toHaveTextContent('Verificando conexão')
  })

  it('shows demo mode when orders stay in the browser', async () => {
    render(<StartScreen connection={portAnswering({ mode: 'demo', reachable: true })} />)

    expect(await screen.findByText('Modo demonstração')).toBeInTheDocument()
  })

  it('shows the local server as connected when the API answers', async () => {
    render(<StartScreen connection={portAnswering({ mode: 'api', reachable: true })} />)

    expect(await screen.findByText('Servidor local conectado')).toBeInTheDocument()
  })

  it('warns when the local server does not answer', async () => {
    render(<StartScreen connection={portAnswering({ mode: 'api', reachable: false })} />)

    expect(await screen.findByText('Servidor local sem resposta')).toBeInTheDocument()
  })
})
