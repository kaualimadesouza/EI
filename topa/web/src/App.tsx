import type { Adapters } from './composition'
import { PhoneApp } from './ui/phone/PhoneApp'
import { StartScreen } from './ui/StartScreen'

interface AppProps {
  adapters: Adapters
  phone?: boolean
}

/** The kiosk is designed for an 800px-wide vertical tablet; wider screens get it centred. */
export function App({ adapters, phone = false }: AppProps) {
  return (
    <div className="flex min-h-dvh justify-center bg-ink">
      <main className="flex min-h-dvh w-full max-w-[800px] flex-col">
        {phone ? <PhoneApp nfc={adapters.nfc} /> : <StartScreen connection={adapters.connection} />}
      </main>
    </div>
  )
}
