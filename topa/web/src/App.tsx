import { useEffect, useState } from 'react'

import type { StoreRole } from './composition'
import { DEMO_STORE_SLUG, locationStore } from './domain/store'
import type { Adapters } from './ports/adapters'
import type { AuthenticatedCustomer } from './ports/customer-auth'
import { CustomerAuthScreen } from './ui/customer/CustomerAuthScreen'
import { StoreSelectorScreen } from './ui/customer/StoreSelectorScreen'
import { KioskApp } from './ui/kiosk/KioskApp'
import { PainelApp } from './ui/painel/PainelApp'
import { PhoneApp } from './ui/phone/PhoneApp'

interface AppProps {
  adapters: Adapters
  path?: string
  phone?: boolean
  storeRole?: StoreRole
  totem?: boolean
  /** The staff gesture on the TOPA mark; in the store app, toggles totem and painel. */
  onSwitchRole?: () => void
}

/** The phone app reads a totem; the store app shows totem or painel; on the web, /painel is the dashboard. */
export function App({
  adapters,
  path = window.location.pathname,
  phone = false,
  storeRole = 'totem',
  totem = false,
  onSwitchRole,
}: AppProps) {
  const [customer, setCustomer] = useState<AuthenticatedCustomer | null>(() =>
    adapters.customerAuth.getCustomer(),
  )
  const [selectedStore, setSelectedStore] = useState<string | null>(null)

  useEffect(() => {
    void adapters.customerAuth.init().then((logged) => {
      setCustomer(logged)
    })
  }, [adapters.customerAuth])

  useEffect(() => {
    const onPopState = () => {
      const loc = locationStore(window.location.href)
      setSelectedStore(loc.kind === 'valid' ? loc.slug : null)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  if (phone) {
    return (
      <main className="flex min-h-dvh flex-col">
        <PhoneApp adapters={adapters} onSwitchRole={onSwitchRole} />
      </main>
    )
  }
  const store = locationStore(window.location.href)
  if (storeRole === 'painel' || path.startsWith(`${import.meta.env.BASE_URL}painel`)) {
    if (store.kind === 'invalid') {
      return (
        <section
          role="alert"
          className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cream px-8 text-center text-ink"
        >
          <h1 className="text-title font-bold">Loja não encontrada</h1>
          <p className="max-w-[36ch] text-body text-muted">
            Confira o identificador da loja no endereço do painel.
          </p>
        </section>
      )
    }
    const storeSlug = store.kind === 'valid' ? store.slug : DEMO_STORE_SLUG
    return (
      <PainelApp
        key={storeSlug}
        adapters={adapters}
        storeSlug={storeSlug}
        onSwitchToTotem={onSwitchRole}
      />
    )
  }
  if (store.kind === 'invalid') {
    return (
      <main className="flex h-dvh flex-col overflow-hidden">
        <section
          role="alert"
          className="flex flex-1 flex-col items-center justify-center gap-4 bg-cream px-8 text-center text-ink"
        >
          <h1 className="text-title font-bold">Loja não encontrada</h1>
          <p className="max-w-[36ch] text-body text-muted">
            Confira o endereço ou aproxime o celular novamente do totem.
          </p>
        </section>
      </main>
    )
  }

  // Customer selected a restaurant or opened via QR / NFC deep link
  const activeStoreSlug = selectedStore ?? (store.kind === 'valid' ? store.slug : null)
  if (activeStoreSlug) {
    return (
      <main className="flex h-dvh flex-col overflow-hidden">
        <KioskApp
          key={activeStoreSlug}
          adapters={adapters}
          storeSlug={activeStoreSlug}
          surface="phone"
          onSwitchRole={onSwitchRole}
        />
      </main>
    )
  }

  // Dedicated store totem device
  if (totem) {
    return (
      <main className="flex h-dvh flex-col overflow-hidden">
        <KioskApp
          key={DEMO_STORE_SLUG}
          adapters={adapters}
          storeSlug={DEMO_STORE_SLUG}
          surface="totem"
          onSwitchRole={onSwitchRole}
        />
      </main>
    )
  }

  // Direct web browser access without QR/NFC: customer authentication required
  if (!customer) {
    return (
      <CustomerAuthScreen
        auth={adapters.customerAuth}
        onAuthSuccess={(logged) => setCustomer(logged)}
      />
    )
  }

  // Authenticated customer choosing restaurant
  return (
    <StoreSelectorScreen
      stores={adapters.stores}
      customer={customer}
      onSelectStore={(slug) => {
        setSelectedStore(slug)
        window.history.pushState(null, '', `?loja=${slug}`)
      }}
      onLogout={() => {
        void Promise.resolve(adapters.customerAuth.logout()).then(() => {
          setCustomer(null)
        })
      }}
    />
  )
}
