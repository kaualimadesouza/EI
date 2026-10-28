import type { Adapters } from './ports/adapters'
import { KioskApp } from './ui/kiosk/KioskApp'
import { PainelApp } from './ui/painel/PainelApp'
import { PhoneApp } from './ui/phone/PhoneApp'

interface AppProps {
  adapters: Adapters
  path?: string
  phone?: boolean
  onUseAsTotem: () => void
  /** Only on a device marked as totem. */
  onLeaveTotem?: () => void
}

/** The phone app reads a totem and opens its store; /painel (under the base path) is the dashboard; the rest is the kiosk. */
export function App({ adapters, path = window.location.pathname, phone = false, onUseAsTotem, onLeaveTotem }: AppProps) {
  if (phone) {
    return (
      <main className="flex min-h-dvh flex-col">
        <PhoneApp adapters={adapters} onUseAsTotem={onUseAsTotem} />
      </main>
    )
  }
  if (path.startsWith(`${import.meta.env.BASE_URL}painel`)) return <PainelApp adapters={adapters} />
  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <KioskApp adapters={adapters} onLeaveTotem={onLeaveTotem} />
    </main>
  )
}
