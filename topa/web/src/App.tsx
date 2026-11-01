import { useEffect, useState } from 'react'

import type { StoreRole } from './composition'
import { DEMO_STORE_SLUG, locationStore } from './domain/store'
import type { Adapters } from './ports/adapters'
import type { AuthenticatedCustomer } from './ports/customer-auth'
import { StoreMark } from './ui/icons'
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
  const [selectedStore, setSelectedStore] = useState<string | null>(() => {
    const loc = locationStore(window.location.href)
    return loc.kind === 'valid' && !loc.sessionToken ? loc.slug : null
  })
  const [showingAuth, setShowingAuth] = useState(false)
  const [sessionValidation, setSessionValidation] = useState<{
    status: 'idle' | 'checking' | 'valid' | 'invalid'
    storeSlug?: string
    message?: string
  }>({ status: 'idle' })

  useEffect(() => {
    void adapters.customerAuth.init().then((logged) => {
      setCustomer(logged)
    })
  }, [adapters.customerAuth])

  useEffect(() => {
    const onPopState = () => {
      const loc = locationStore(window.location.href)
      setSelectedStore(loc.kind === 'valid' ? loc.slug : null)
      if (loc.kind === 'absent') {
        setSessionValidation({ status: 'idle' })
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const store = locationStore(window.location.href)
  const storeSlug = store.kind === 'valid' ? store.slug : null
  const sessionToken = store.kind === 'valid' ? store.sessionToken : null

  // Validate temporary totem session when opening via totem QR code or NFC tag
  useEffect(() => {
    if (!storeSlug || !sessionToken) return
    let active = true
    setSessionValidation({ status: 'checking', storeSlug })
    adapters.totemSession
      .validateSession(sessionToken, storeSlug)
      .then((res) => {
        if (!active) return
        if (res.valid && res.storeSlug) {
          setSessionValidation({ status: 'valid', storeSlug: res.storeSlug })
        } else {
          setSessionValidation({
            status: 'invalid',
            storeSlug,
            message:
              res.reason === 'expired'
                ? 'A sessão temporária do totem expirou. Escolha um restaurante abaixo para pedir pelo celular.'
                : 'Sessão do totem inválida ou expirada. Escolha um restaurante abaixo para fazer seu pedido.',
          })
        }
      })
      .catch(() => {
        if (!active) return
        setSessionValidation({
          status: 'invalid',
          storeSlug,
          message: 'Não foi possível validar a sessão do totem. Escolha um restaurante abaixo:',
        })
      })
    return () => {
      active = false
    }
  }, [adapters.totemSession, storeSlug, sessionToken])

  if (phone) {
    return (
      <main className="flex min-h-dvh flex-col">
        <PhoneApp adapters={adapters} onSwitchRole={onSwitchRole} />
      </main>
    )
  }

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

  // While validating a totem session token from QR code / NFC tag
  if (sessionValidation.status === 'checking') {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-cream px-8 text-center text-ink">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inline-flex h-full w-full rounded-full bg-teal opacity-50 motion-safe:animate-ping" />
          <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-teal text-white">
            <StoreMark size={28} />
          </span>
        </div>
        <h1 className="text-[20px] font-bold">Validando sessão do totem...</h1>
        <p className="max-w-[36ch] text-[14px] text-muted">
          Conectando ao totem da loja para liberar o cardápio no seu celular.
        </p>
      </main>
    )
  }

  // Valid session token from totem QR code or customer selected a store on the web
  const activeStoreSlug =
    sessionValidation.status === 'valid'
      ? sessionValidation.storeSlug
      : selectedStore

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

  // Customer clicked "Entrar / Cadastrar" while browsing on the web
  if (showingAuth && !customer) {
    return (
      <CustomerAuthScreen
        auth={adapters.customerAuth}
        onAuthSuccess={(logged) => {
          setCustomer(logged)
          setShowingAuth(false)
        }}
      />
    )
  }

  // Default web entry: restaurant selector with proximity sorting and no login required
  const notice =
    sessionValidation.status === 'invalid'
      ? sessionValidation.message
      : null

  return (
    <StoreSelectorScreen
      stores={adapters.stores}
      orders={adapters.orders}
      customer={customer}
      sessionNotice={notice}
      onSelectStore={(slug) => {
        setSelectedStore(slug)
        window.history.pushState(null, '', `?loja=${slug}`)
      }}
      onLoginRequest={() => setShowingAuth(true)}
      onLogout={() => {
        void Promise.resolve(adapters.customerAuth.logout()).then(() => {
          setCustomer(null)
        })
      }}
    />
  )
}
