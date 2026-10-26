import { useState } from 'react'

import type { StoreRef } from '../../domain/store'
import type { NfcPort } from '../../ports/nfc'
import { PhoneHome } from './PhoneHome'
import { StoreFound } from './StoreFound'

interface PhoneAppProps {
  nfc: NfcPort
}

/** The phone app: read a totem's sticker, then show that store (the menu replaces StoreFound later). */
export function PhoneApp({ nfc }: PhoneAppProps) {
  const [store, setStore] = useState<StoreRef | null>(null)

  if (store) return <StoreFound store={store} onScanAgain={() => setStore(null)} />
  return <PhoneHome nfc={nfc} onStore={setStore} />
}
