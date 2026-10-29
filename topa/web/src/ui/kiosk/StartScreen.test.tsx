import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { ConnectionPort } from '../../ports/connection'
import { StartScreen } from './StartScreen'

const ONLINE = 'Servidor conectado'
const OFFLINE = 'Servidor sem resposta: chame um atendente'

function portAnswering(reachable: boolean): ConnectionPort {
  return { isReachable: () => Promise.resolve(reachable) }
}

const pending: ConnectionPort = { isReachable: () => new Promise<boolean>(() => {}) }

function renderStart(
  mode: 'api' | 'demo',
  connection: ConnectionPort,
  storeName: string | null = 'Lanchonete Bem-te-vi',
) {
  const onBegin = vi.fn()
  const onQueue = vi.fn()
  const view = render(
    <StartScreen
      storeName={storeName}
      surface="totem"
      serverStatus={{ mode, connection }}
      onBegin={onBegin}
      onQueue={onQueue}
    />,
  )
  return { onBegin, onQueue, view }
}

describe('StartScreen', () => {
  it('greets the customer with the store and the headline', () => {
    renderStart('api', pending, 'Cantina Central')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Peça aqui. Pague aqui.')
    expect(screen.getByText('Cantina Central')).toBeInTheDocument()
    expect(screen.getByText('Monte o pedido, pague por aproximação ou Pix e retire no balcão.')).toBeInTheDocument()
    expect(screen.getByText('por TOPA')).toBeInTheDocument()
  })

  it('hides the store pill while the store name has not arrived yet', () => {
    renderStart('api', pending, null)

    expect(screen.queryByText('Lanchonete Bem-te-vi')).not.toBeInTheDocument()
  })

  it('on the customer phone omits the server status pill, never pings the server and explains Pix payment', () => {
    const isReachable = vi.fn(() => Promise.resolve(true))
    render(<StartScreen storeName="Cantina Central" surface="phone" onBegin={vi.fn()} />)

    expect(isReachable).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('Monte o pedido, pague com Pix e retire no balcão.')).toBeInTheDocument()
  })

  it('starts a dine-in or take-away order, or opens the phone queue', async () => {
    const user = userEvent.setup()
    const { onBegin, onQueue } = renderStart('demo', pending)

    await user.click(screen.getByRole('button', { name: /Comer aqui/ }))
    await user.click(screen.getByRole('button', { name: /Levar para viagem/ }))
    await user.click(screen.getByRole('button', { name: 'A fila está grande? Peça pelo celular' }))

    expect(onBegin.mock.calls).toEqual([[true], [false]])
    expect(onQueue).toHaveBeenCalledOnce()
  })

  it('says it is checking while the server has not answered', () => {
    renderStart('api', pending)

    expect(screen.getByRole('status')).toHaveTextContent('Verificando conexão')
  })

  it('shows demo mode at once, without waiting for any answer', () => {
    renderStart('demo', pending)

    expect(screen.getByRole('status')).toHaveTextContent('Modo demonstração')
  })

  it('shows the server as connected when the API answers', async () => {
    renderStart('api', portAnswering(true))

    expect(await screen.findByText(ONLINE)).toBeInTheDocument()
  })

  it('warns and says what to check when the server does not answer', async () => {
    renderStart('api', portAnswering(false))

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
    const { view } = renderStart('api', first)

    view.rerender(
      <StartScreen
        storeName="Lanchonete Bem-te-vi"
        surface="totem"
        serverStatus={{ mode: 'api', connection: portAnswering(false) }}
        onBegin={vi.fn()}
        onQueue={vi.fn()}
      />,
    )
    expect(await screen.findByText(OFFLINE)).toBeInTheDocument()
    await act(async () => answerFirst(true))

    expect(screen.getByRole('status')).toHaveTextContent(OFFLINE)
    expect(screen.queryByText(ONLINE)).not.toBeInTheDocument()
  })

  it('shows the app version, so staff can tell which build a totem runs', () => {
    renderStart('demo', pending)

    expect(screen.getByText('por TOPA')).toHaveTextContent(`v${__APP_VERSION__}`)
  })
})
