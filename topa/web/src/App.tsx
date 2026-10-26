import type { Adapters } from './ports/adapters'
import { StartScreen } from './ui/StartScreen'

interface AppProps {
  adapters: Adapters
}

/** The kiosk is designed for an 800px-wide vertical tablet; wider screens get it centred. */
export function App({ adapters }: AppProps) {
  return (
    <div className="flex min-h-dvh justify-center bg-ink">
      <main className="flex min-h-dvh w-full max-w-[800px] flex-col">
        <StartScreen mode={adapters.mode} connection={adapters.connection} />
      </main>
    </div>
  )
}
