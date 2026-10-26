import { NFCTypeNameFormat, RTD_URI, scan, type Tag, type TagRecord } from '@tauri-apps/plugin-nfc'

import type { NfcPort, ScanFailure, TagUrl } from '../../ports/nfc'

// NFC Forum URI record prefix codes; every code past https:// is a scheme the app cannot open
const WEB_PREFIXES = ['', 'http://www.', 'https://www.', 'http://', 'https://']

function webUrlOf({ tnf, kind, payload }: TagRecord): string | null {
  if (tnf !== NFCTypeNameFormat.NfcWellKnown || kind.join() !== RTD_URI.join()) return null
  const [code, ...rest] = payload
  const prefix: string | undefined = WEB_PREFIXES[code]
  if (prefix === undefined) return null
  // Uint8Array wraps the signed Java bytes Android sends back into UTF-8
  return prefix + new TextDecoder().decode(new Uint8Array(rest))
}

function urlOf(tag: Tag): TagUrl | ScanFailure {
  const url = tag.records.map(webUrlOf).find((found) => found !== null)
  return url ? { kind: 'url', url } : { kind: 'no-url' }
}

// Android rejects with { message }; a call that never reached the plugin rejects with a string
function failureOf(error: unknown): ScanFailure {
  const reason =
    typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error)
  if (reason.includes('does not have NFC')) return { kind: 'no-nfc' }
  if (reason.includes('disabled')) return { kind: 'nfc-off' }
  return { kind: 'nothing-read' }
}

/** The phone app's reader, over the official Tauri NFC plugin (Android). */
export class TauriNfc implements NfcPort {
  scan(signal: AbortSignal): Promise<TagUrl | ScanFailure> {
    if (signal.aborted) return Promise.resolve({ kind: 'nothing-read' })
    // the plugin cannot cancel a scan: an aborted one resolves now and its late tag is dropped
    const cancelled = new Promise<ScanFailure>((resolve) => {
      signal.addEventListener('abort', () => resolve({ kind: 'nothing-read' }), { once: true })
    })
    // 'tag', not 'ndef': without a data filter Android never matches the ndef kind to a URI sticker
    const read = scan({ type: 'tag' }).then(urlOf, failureOf)
    return Promise.race([read, cancelled])
  }
}
