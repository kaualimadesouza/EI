import type { Adapters } from './ports/adapters'
import { KioskApp } from './ui/kiosk/KioskApp'
import { PainelApp } from './ui/painel/PainelApp'

interface AppProps {
  adapters: Adapters
  path?: string
}

/** /painel (under the deploy's base path) is the merchant's dashboard; every other path is the kiosk. */
export function App({ adapters, path = window.location.pathname }: AppProps) {
  if (path.startsWith(`${import.meta.env.BASE_URL}painel`)) return <PainelApp adapters={adapters} />
  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <KioskApp adapters={adapters} />
    </main>
  )
}
