import type { NfcPort, ScanFailure } from '../../ports/nfc'

/** Desktop builds and browsers without Web NFC: there is nothing to read with. */
export class UnavailableNfc implements NfcPort {
  scan(): Promise<ScanFailure> {
    return Promise.resolve({ kind: 'no-nfc' })
  }
}
