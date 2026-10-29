import { DEMO_STORE_SLUG, locationStore } from './domain/store'
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
  const store = locationStore(window.location.href)
  if (path.startsWith(`${import.meta.env.BASE_URL}painel`)) {
    if (store.kind === 'invalid') {
      return (
        <section role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cream px-8 text-center text-ink">
          <h1 className="text-title font-bold">Loja não encontrada</h1>
          <p className="max-w-[36ch] text-body text-muted">
            Confira o identificador da loja no endereço do painel.
          </p>
        </section>
      )
    }
    const storeSlug = store.kind === 'valid' ? store.slug : DEMO_STORE_SLUG
    return <PainelApp key={storeSlug} adapters={adapters} storeSlug={storeSlug} />
  }
  if (store.kind === 'invalid') {
    return (
      <main className="flex h-dvh flex-col overflow-hidden">
        <section role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 bg-cream px-8 text-center text-ink">
          <h1 className="text-title font-bold">Loja não encontrada</h1>
          <p className="max-w-[36ch] text-body text-muted">
            Confira o endereço ou aproxime o celular novamente do totem.
          </p>
        </section>
      </main>
    )
  }
  const storeSlug = store.kind === 'valid' ? store.slug : DEMO_STORE_SLUG
  const surface = store.kind === 'valid' ? 'phone' : 'totem'
  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <KioskApp
        key={storeSlug}
        adapters={adapters}
        storeSlug={storeSlug}
        surface={surface}
        onSwitchRole={onSwitchRole}
      />
    </main>
  )
}
