import type { Adapters } from './ports/adapters'
import { KioskApp } from './ui/kiosk/KioskApp'

interface AppProps {
  adapters: Adapters
}

/** The same screens fill a vertical totem, a phone that came through the queue QR, or a desktop window. */
export function App({ adapters }: AppProps) {
  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <KioskApp adapters={adapters} />
    </main>
  )
}
