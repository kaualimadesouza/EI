import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { ConnectionPort } from '../ports/connection'
import { StartScreen } from './StartScreen'

const ONLINE = 'Servidor local conectado'
const OFFLINE = 'Servidor local sem resposta: confira o make run'

function portAnswering(reachable: boolean): ConnectionPort {
  return { isReachable: () => Promise.resolve(reachable) }
}

const pending: ConnectionPort = { isReachable: () => new Promise<boolean>(() => {}) }

describe('StartScreen', () => {
  it('greets the customer with the store and the headline', () => {
    render(<StartScreen mode="api" connection={pending} />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Peça aqui. Pague aqui.')
    expect(screen.getByText('Lanchonete Bem-te-vi')).toBeInTheDocument()
    expect(screen.getByText('por TOPA')).toBeInTheDocument()
  })

  it('says it is checking while the local server has not answered', () => {
    render(<StartScreen mode="api" connection={pending} />)

    expect(screen.getByRole('status')).toHaveTextContent('Verificando conexão')
  })

  it('shows demo mode at once, without waiting for any answer', () => {
    render(<StartScreen mode="demo" connection={pending} />)

    expect(screen.getByRole('status')).toHaveTextContent('Modo demonstração')
  })

  it('shows the local server as connected when the API answers', async () => {
    render(<StartScreen mode="api" connection={portAnswering(true)} />)

    expect(await screen.findByText(ONLINE)).toBeInTheDocument()
  })

  it('warns and says what to check when the local server does not answer', async () => {
    render(<StartScreen mode="api" connection={portAnswering(false)} />)

    expect(await screen.findByText(OFFLINE)).toBeInTheDocument()
  })

  it('shows the answer of the current connection, never a late one from the previous', async () => {
    let answerFirst: (reachable: boolean) => void = () => {}
    const first: ConnectionPort = {
      isReachable: () =>
        new Promise<boolean>((resolve) => {
          answerFirst = resolve
        }),
    }
    const { rerender } = render(<StartScreen mode="api" connection={first} />)

    rerender(<StartScreen mode="api" connection={portAnswering(false)} />)
    expect(await screen.findByText(OFFLINE)).toBeInTheDocument()
    await act(async () => answerFirst(true))

    expect(screen.getByRole('status')).toHaveTextContent(OFFLINE)
    expect(screen.queryByText(ONLINE)).not.toBeInTheDocument()
  })
})
