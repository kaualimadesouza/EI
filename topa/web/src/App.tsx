import type { Adapters } from './ports/adapters'
import { KioskApp } from './ui/kiosk/KioskApp'
import { PainelApp } from './ui/painel/PainelApp'

interface AppProps {
  adapters: Adapters
  path?: string
}

/** /painel is the merchant's dashboard; every other path is the kiosk, on a totem, a phone or a desktop. */
export function App({ adapters, path = window.location.pathname }: AppProps) {
  if (path.startsWith('/painel')) return <PainelApp adapters={adapters} />
  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <KioskApp adapters={adapters} />
    </main>
  )
}
