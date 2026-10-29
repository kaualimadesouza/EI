import { useState } from 'react'

import type { StoreRef } from '../../domain/store'
import type { Adapters } from '../../ports/adapters'
import { ArrowLeftIcon } from '../icons'
import { KioskApp } from '../kiosk/KioskApp'
import { PhoneHome } from './PhoneHome'

interface PhoneAppProps {
  adapters: Adapters
  onSwitchRole?: () => void
}

/** The phone app: plain TOPA until a totem is read, then that store's ordering screens, with a way back. */
export function PhoneApp({ adapters, onSwitchRole }: PhoneAppProps) {
  const [store, setStore] = useState<StoreRef | null>(null)

  if (!store) return <PhoneHome nfc={adapters.nfc} onStore={setStore} onSwitchRole={onSwitchRole} />
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <button
        type="button"
        onClick={() => setStore(null)}
        className="flex min-h-16 flex-none items-center gap-2 border-b border-line bg-cream px-4 text-base font-semibold text-slate"
      >
        <ArrowLeftIcon size={20} />
        Ler outro totem
      </button>
      <KioskApp key={store.slug} adapters={adapters} storeSlug={store.slug} surface="phone" />
    </div>
  )
}
