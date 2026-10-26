import type { NfcPort, ScanFailure, TagUrl } from '../../ports/nfc'

/** The part of a Web NFC record this app reads; TypeScript's DOM types do not ship Web NFC. */
export interface NdefRecord {
  recordType: string
  data: DataView
}

export interface NdefReader {
  onreading: ((event: { message: { records: readonly NdefRecord[] } }) => void) | null
  onreadingerror: (() => void) | null
  scan(options: { signal: AbortSignal }): Promise<void>
}

declare global {
  interface Window {
    NDEFReader?: new () => NdefReader
  }
}

function urlOf(records: readonly NdefRecord[]): TagUrl | ScanFailure {
  const record = records.find(({ recordType }) => recordType === 'url')
  return record ? { kind: 'url', url: new TextDecoder().decode(record.data) } : { kind: 'no-url' }
}

function failureOf(error: unknown): ScanFailure {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotSupportedError') return { kind: 'no-nfc' }
  if (name === 'NotReadableError') return { kind: 'nfc-off' }
  return { kind: 'nothing-read' }
}

/** Web NFC (Chrome on Android), so the store page opened in the browser can read the sticker too. */
export class WebNfc implements NfcPort {
  private readonly createReader: () => NdefReader

  constructor(createReader: () => NdefReader) {
    this.createReader = createReader
  }

  scan(signal: AbortSignal): Promise<TagUrl | ScanFailure> {
    return new Promise((resolve) => {
      const reader = this.createReader()
      // a Web NFC reader listens until its signal aborts: stop it at the first tag or on cancel
      const done = new AbortController()
      const stop = AbortSignal.any([signal, done.signal])
      const finish = (outcome: TagUrl | ScanFailure) => {
        resolve(outcome)
        done.abort()
      }
      stop.addEventListener('abort', () => resolve({ kind: 'nothing-read' }), { once: true })
      reader.onreading = ({ message }) => finish(urlOf(message.records))
      reader.onreadingerror = () => finish({ kind: 'no-url' })
      reader.scan({ signal: stop }).catch((error: unknown) => finish(failureOf(error)))
    })
  }
}
