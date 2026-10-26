import { describe, expect, it } from 'vitest'

import type { NfcPort } from '../../ports/nfc'
import { UnavailableNfc } from './unavailable-nfc'

describe('UnavailableNfc', () => {
  it('answers that this device has no NFC, so the screen can say so', async () => {
    const nfc: NfcPort = new UnavailableNfc()

    expect(await nfc.scan(new AbortController().signal)).toEqual({ kind: 'no-nfc' })
  })
})
