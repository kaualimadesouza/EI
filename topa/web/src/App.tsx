import { storeFromUrl } from './domain/store'
import type { Adapters } from './ports/adapters'
import { KioskApp } from './ui/kiosk/KioskApp'
import { PainelApp } from './ui/painel/PainelApp'
import { PhoneApp } from './ui/phone/PhoneApp'

interface AppProps {
  adapters: Adapters
  path?: string
  phone?: boolean
  /** The staff gesture on the TOPA mark; only the Android app has a role to switch. */
  onSwitchRole?: () => void
}

/** The phone app reads a totem and opens its store; /painel (under the base path) is the dashboard; the rest is the kiosk. */
export function App({ adapters, path = window.location.pathname, phone = false, onSwitchRole }: AppProps) {
  if (phone) {
    return (
      <main className="flex min-h-dvh flex-col">
        <PhoneApp adapters={adapters} onSwitchRole={onSwitchRole} />
      </main>
    )
  }
  const store = storeFromUrl(window.location.href)
  if (path.startsWith(`${import.meta.env.BASE_URL}painel`)) {
    return <PainelApp adapters={adapters} storeSlug={store?.slug} />
  }
  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <KioskApp adapters={adapters} onSwitchRole={onSwitchRole} customerStore={store?.slug} />
    </main>
  )
}
