import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ConnectionPort } from '../../ports/connection'
import { StartScreen } from './StartScreen'

const ONLINE = 'Servidor local conectado'
const OFFLINE = 'Servidor local sem resposta: confira o make run'

function portAnswering(reachable: boolean): ConnectionPort {
  return { isReachable: () => Promise.resolve(reachable) }
}

const pending: ConnectionPort = { isReachable: () => new Promise<boolean>(() => {}) }

function renderStart(mode: 'api' | 'demo', connection: ConnectionPort) {
  const onBegin = vi.fn()
  const onQueue = vi.fn()
  const view = render(<StartScreen mode={mode} connection={connection} onBegin={onBegin} onQueue={onQueue} />)
  return { onBegin, onQueue, view }
}

describe('StartScreen', () => {
  it('greets the customer with the store and the headline', () => {
    renderStart('api', pending)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Peça aqui. Pague aqui.')
    expect(screen.getByText('Lanchonete Bem-te-vi')).toBeInTheDocument()
    expect(screen.getByText('por TOPA')).toBeInTheDocument()
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

  it('says it is checking while the local server has not answered', () => {
    renderStart('api', pending)

    expect(screen.getByRole('status')).toHaveTextContent('Verificando conexão')
  })

  it('shows demo mode at once, without waiting for any answer', () => {
    renderStart('demo', pending)

    expect(screen.getByRole('status')).toHaveTextContent('Modo demonstração')
  })

  it('shows the local server as connected when the API answers', async () => {
    renderStart('api', portAnswering(true))

    expect(await screen.findByText(ONLINE)).toBeInTheDocument()
  })

  it('warns and says what to check when the local server does not answer', async () => {
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

    view.rerender(<StartScreen mode="api" connection={portAnswering(false)} onBegin={vi.fn()} onQueue={vi.fn()} />)
    expect(await screen.findByText(OFFLINE)).toBeInTheDocument()
    await act(async () => answerFirst(true))

    expect(screen.getByRole('status')).toHaveTextContent(OFFLINE)
    expect(screen.queryByText(ONLINE)).not.toBeInTheDocument()
  })

  it('shows the app version, so staff can tell which build a totem runs', () => {
    renderStart('demo', pending)

    expect(screen.getByText(`v${__APP_VERSION__}`)).toBeInTheDocument()
  })

  describe('on a device marked as totem', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    function renderTotem() {
      const onLeaveTotem = vi.fn()
      const view = render(
        <StartScreen mode="demo" connection={pending} onBegin={vi.fn()} onQueue={vi.fn()} onLeaveTotem={onLeaveTotem} />,
      )
      return { onLeaveTotem, view, mark: screen.getByText('por TOPA') }
    }

    it('goes back to the phone app when staff hold the TOPA mark for 3 s', () => {
      const { onLeaveTotem, mark } = renderTotem()

      fireEvent.pointerDown(mark)
      act(() => vi.advanceTimersByTime(2999))
      expect(onLeaveTotem).not.toHaveBeenCalled()
      act(() => vi.advanceTimersByTime(1))

      expect(onLeaveTotem).toHaveBeenCalledOnce()
    })

    it('ignores a short press and a hold cut by leaving the screen', () => {
      const { onLeaveTotem, mark, view } = renderTotem()

      fireEvent.pointerDown(mark)
      act(() => vi.advanceTimersByTime(1000))
      fireEvent.pointerUp(mark)
      fireEvent.pointerDown(mark)
      view.unmount()
      act(() => vi.advanceTimersByTime(5000))

      expect(onLeaveTotem).not.toHaveBeenCalled()
    })
  })
})
