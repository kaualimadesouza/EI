import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { NfcPort, ScanFailure, TagUrl } from '../../ports/nfc'
import { PhoneHome } from './PhoneHome'

const STORE_URL = 'https://topa-totem.vercel.app/?loja=lanchonete-bauru'

/** A reader whose scans stay open until the test answers them, like a phone waiting for a tag. */
function pendingReader() {
  const answers: ((outcome: TagUrl | ScanFailure) => void)[] = []
  const signals: AbortSignal[] = []
  const nfc: NfcPort = {
    scan: (signal) => {
      signals.push(signal)
      return new Promise((resolve) => answers.push(resolve))
    },
  }
  return { nfc, answers, signals }
}

function readerAnswering(...outcomes: (TagUrl | ScanFailure)[]): NfcPort {
  const queue = [...outcomes]
  return { scan: vi.fn(() => Promise.resolve(queue.shift() ?? { kind: 'nothing-read' as const })) }
}

async function tapToScan() {
  await userEvent.click(screen.getByRole('button', { name: 'Aproximar do totem' }))
}

describe('PhoneHome', () => {
  it('opens on plain TOPA, with no store and no staff option in sight', () => {
    render(<PhoneHome nfc={pendingReader().nfc} onStore={vi.fn()} />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Peça pelo celular.')
    expect(screen.getByText(`v${__APP_VERSION__}`)).toBeInTheDocument()
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Aproximar do totem'])
    expect(screen.queryByText(/Bem-te-vi/)).not.toBeInTheDocument()
  })

  it('asks for the phone on the totem while it scans', async () => {
    render(<PhoneHome nfc={pendingReader().nfc} onStore={vi.fn()} />)

    await tapToScan()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Encoste o celular atrás do totem ou no adesivo TOPA.',
    )
    expect(screen.queryByRole('button', { name: 'Aproximar do totem' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('hands over the store written on the sticker', async () => {
    const onStore = vi.fn()
    render(<PhoneHome nfc={readerAnswering({ kind: 'url', url: STORE_URL })} onStore={onStore} />)

    await tapToScan()

    expect(onStore).toHaveBeenCalledWith({ slug: 'lanchonete-bauru', url: STORE_URL })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('goes back to the start on cancel and ignores a tag read afterwards', async () => {
    const onStore = vi.fn()
    const reader = pendingReader()
    render(<PhoneHome nfc={reader.nfc} onStore={onStore} />)
    await tapToScan()

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    reader.answers[0]({ kind: 'url', url: STORE_URL })

    expect(reader.signals[0].aborted).toBe(true)
    expect(await screen.findByRole('button', { name: 'Aproximar do totem' })).toBeInTheDocument()
    expect(onStore).not.toHaveBeenCalled()
  })

  it('stops scanning when the screen goes away', async () => {
    const reader = pendingReader()
    const { unmount } = render(<PhoneHome nfc={reader.nfc} onStore={vi.fn()} />)
    await tapToScan()

    unmount()

    expect(reader.signals[0].aborted).toBe(true)
  })

  it('says the phone has no NFC and points to the QR Code, with nothing to retry', async () => {
    render(<PhoneHome nfc={readerAnswering({ kind: 'no-nfc' })} onStore={vi.fn()} />)

    await tapToScan()

    expect(screen.getByRole('alert')).toHaveTextContent('Este celular não tem NFC.')
    expect(screen.getByRole('alert')).toHaveTextContent('Leia o QR Code do totem com a câmera')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('says NFC is off and how to turn it on', async () => {
    render(<PhoneHome nfc={readerAnswering({ kind: 'nfc-off' })} onStore={vi.fn()} />)

    await tapToScan()

    expect(screen.getByRole('alert')).toHaveTextContent('O NFC está desligado.')
    expect(screen.getByRole('alert')).toHaveTextContent('Ative o NFC nas configurações do celular')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })

  it('does not recognize a tag without a URL', async () => {
    render(<PhoneHome nfc={readerAnswering({ kind: 'no-url' })} onStore={vi.fn()} />)

    await tapToScan()

    expect(screen.getByRole('alert')).toHaveTextContent('Não é um totem TOPA.')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })

  it('does not recognize a URL that is not a TOPA store', async () => {
    const onStore = vi.fn()
    render(<PhoneHome nfc={readerAnswering({ kind: 'url', url: 'https://example.com/' })} onStore={onStore} />)

    await tapToScan()

    expect(screen.getByRole('alert')).toHaveTextContent('Não é um totem TOPA.')
    expect(onStore).not.toHaveBeenCalled()
  })

  it('says the sticker could not be read when the read fails', async () => {
    render(<PhoneHome nfc={readerAnswering({ kind: 'nothing-read' })} onStore={vi.fn()} />)

    await tapToScan()

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível ler o totem.')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })

  it('scans again from an error and opens the store this time', async () => {
    const onStore = vi.fn()
    const nfc = readerAnswering({ kind: 'nfc-off' }, { kind: 'url', url: STORE_URL })
    render(<PhoneHome nfc={nfc} onStore={onStore} />)
    await tapToScan()

    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(nfc.scan).toHaveBeenCalledTimes(2)
    expect(onStore).toHaveBeenCalledWith({ slug: 'lanchonete-bauru', url: STORE_URL })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
