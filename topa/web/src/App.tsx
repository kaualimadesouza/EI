import type { Adapters } from './ports/adapters'
import { KioskApp } from './ui/kiosk/KioskApp'

interface AppProps {
  adapters: Adapters
}

/** The kiosk is designed for an 800px-wide vertical tablet; wider screens get it centred. */
export function App({ adapters }: AppProps) {
  return (
    <div className="flex min-h-dvh justify-center bg-ink">
      <main className="flex h-dvh w-full max-w-[800px] flex-col overflow-hidden">
        <KioskApp adapters={adapters} />
      </main>
    </div>
  )
}
