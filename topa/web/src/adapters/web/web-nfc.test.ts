import { describe, expect, it } from 'vitest'

import { type NdefReader, WebNfc } from './web-nfc'

/** Stands in for Chrome's NDEFReader: `scan` answers what the test says, events are fired by hand. */
class FakeReader implements NdefReader {
  onreading: NdefReader['onreading'] = null
  onreadingerror: NdefReader['onreadingerror'] = null
  signal: AbortSignal | null = null
  private readonly answer: Promise<void>

  constructor(answer: Promise<void> = Promise.resolve()) {
    this.answer = answer
  }

  scan(options: { signal: AbortSignal }): Promise<void> {
    this.signal = options.signal
    return this.answer
  }

  read(...records: { recordType: string; text: string }[]) {
    const encoded = records.map(({ recordType, text }) => ({
      recordType,
      data: new DataView(new TextEncoder().encode(text).buffer),
    }))
    this.onreading?.({ message: { records: encoded } })
  }
}

function scanWith(reader: FakeReader, signal = new AbortController().signal) {
  return new WebNfc(() => reader).scan(signal)
}

describe('WebNfc', () => {
  it('returns the URL of the first url record and stops listening', async () => {
    const reader = new FakeReader()
    const outcome = scanWith(reader)

    reader.read({ recordType: 'text', text: 'olá' }, { recordType: 'url', text: 'https://topa.app/?loja=a' })

    expect(await outcome).toEqual({ kind: 'url', url: 'https://topa.app/?loja=a' })
    expect(reader.signal?.aborted).toBe(true)
  })

  it('reports a tag without a url record as no-url', async () => {
    const reader = new FakeReader()
    const outcome = scanWith(reader)

    reader.read({ recordType: 'text', text: 'olá' })

    expect(await outcome).toEqual({ kind: 'no-url' })
  })

  it('reports a tag the browser could not read as no-url', async () => {
    const reader = new FakeReader()
    const outcome = scanWith(reader)

    reader.onreadingerror?.()

    expect(await outcome).toEqual({ kind: 'no-url' })
    expect(reader.signal?.aborted).toBe(true)
  })

  it('stops the reader and reports nothing-read when the signal aborts', async () => {
    const reader = new FakeReader()
    const controller = new AbortController()
    const outcome = scanWith(reader, controller.signal)

    controller.abort()

    expect(await outcome).toEqual({ kind: 'nothing-read' })
    expect(reader.signal?.aborted).toBe(true)
  })

  it.each([
    ['NotSupportedError', 'no-nfc'],
    ['NotReadableError', 'nfc-off'],
    ['NotAllowedError', 'nothing-read'],
    ['AbortError', 'nothing-read'],
  ])('maps a scan rejected with %s to %s', async (name, kind) => {
    const reader = new FakeReader(Promise.reject(new DOMException('scan failed', name)))

    expect(await scanWith(reader)).toEqual({ kind })
  })

  it('reports an unexpected scan error as nothing-read', async () => {
    const reader = new FakeReader(Promise.reject(new TypeError('NDEFReader is not a constructor')))

    expect(await scanWith(reader)).toEqual({ kind: 'nothing-read' })
  })
})
