import { useCallback, useEffect, useRef, useState } from 'react'

import { itemCount, totalCents } from '../../domain/cart'
import { findProduct, formatBRL, type Product } from '../../domain/menu'
import type { RecommendationItem } from '../../domain/recommendation'
import { phoneMenuUrl, type StoreMenu } from '../../domain/store'
import { bannerFor } from '../../domain/suggest'
import type { Adapters } from '../../ports/adapters'
import { StoreNotFoundError } from '../../ports/menu'
import { OrderRejectedError } from '../../ports/orders'
import { BrandMark } from '../BrandMark'
import { CheckIcon } from '../icons'
import { BagScreen } from './BagScreen'
import { DoneScreen, QueueScreen } from './EndScreens'
import * as flow from './flow'
import { MenuScreen } from './MenuScreen'
import { PagerScreen } from './PagerScreen'
import { ChoiceButtons, KioskHeader, PRIMARY_ACTION, Sheet } from './parts'
import { PaymentScreen, PIX_SECONDS } from './PaymentScreen'
import { photoOf } from './photo'
import { StartScreen } from './StartScreen'
import { useCountdown } from './use-countdown'
import { VoiceOrderModal } from './VoiceOrderModal'

interface KioskAppProps {
  adapters: Adapters
  storeSlug: string
  sessionToken?: string
  surface?: 'totem' | 'phone'
  now?: () => Date
  /** The staff gesture on the TOPA mark; only the Android app has a role to switch. */
  onSwitchRole?: () => void
}

const IDLE_SECONDS = 45
const IDLE_WARNING_SECONDS = 15

export function KioskApp({
  adapters,
  storeSlug,
  sessionToken,
  surface = 'totem',
  now = () => new Date(),
  onSwitchRole,
}: KioskAppProps) {
  const onCustomerPhone = surface === 'phone'
  const [state, setState] = useState<flow.KioskState>({
    ...flow.START,
    paymentMethod: onCustomerPhone ? 'pix' : 'card',
  })
  const [storeName, setStoreName] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [menuState, setMenuState] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading')
  const [recommendations, setRecommendations] = useState<readonly RecommendationItem[]>([])
  const [voiceModalOpen, setVoiceModalOpen] = useState(false)
  const [touches, setTouches] = useState(0)
  const requestId = useRef(0)
  const sessionId = useRef(crypto.randomUUID())

  useEffect(() => () => {
    requestId.current += 1
  }, [])

  const applyMenu = useCallback((menu: StoreMenu) => {
    setStoreName(menu.store.name)
    setProducts(menu.products)
    setState((s) => flow.pruneUnavailable(s, menu.products))
  }, [])

  const loadMenu = useCallback(() => {
    const id = ++requestId.current
    setMenuState('loading')
    adapters.menu.load(storeSlug).then(
      (menu) => {
        if (id !== requestId.current) return
        applyMenu(menu)
        setMenuState('ready')
      },
      (error: unknown) => {
        if (id !== requestId.current) return
        setMenuState(error instanceof StoreNotFoundError ? 'not-found' : 'error')
      },
    )
  }, [adapters.menu, applyMenu, storeSlug])

  // a fresh menu at every new customer picks up what sold out meanwhile
  useEffect(() => {
    if (state.screen === 'start') loadMenu()
  }, [state.screen, loadMenu])

  const [totemSessionToken, setTotemSessionToken] = useState<string | undefined>(sessionToken)

  useEffect(() => {
    if (sessionToken !== undefined) {
      setTotemSessionToken(sessionToken)
      return
    }
    if (onCustomerPhone) return
    let active = true
    const renewSession = () => {
      adapters.totemSession
        .createSession(storeSlug)
        .then((session) => {
          if (active) setTotemSessionToken(session.token)
        })
        .catch(() => {
          // Fallback gracefully if session backend is temporarily unavailable
        })
    }
    renewSession()
    const interval = setInterval(renewSession, 10 * 60 * 1000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [adapters.totemSession, onCustomerPhone, sessionToken, storeSlug])

  const menuUrl = phoneMenuUrl(
    window.location.origin,
    import.meta.env.BASE_URL,
    storeSlug,
    totemSessionToken,
  )
  // only where a phone is invited to tap: from the menu on, that spot takes the payment card
  const servesTag = !onCustomerPhone && menuState !== 'not-found' && (state.screen === 'start' || state.screen === 'queue')
  useEffect(() => {
    if (!servesTag) return
    adapters.tag.publish(menuUrl)
    return () => adapters.tag.withdraw()
  }, [adapters.tag, menuUrl, servesTag])

  const shopping = ['menu', 'bag', 'payment'].includes(state.screen)
  const idleWatch = !onCustomerPhone && shopping && state.sheet !== 'idle' && state.payment !== 'processing'
  const waitingPix = state.screen === 'payment' && state.paymentMethod === 'pix' && state.payment === 'choosing'
  // a touch must not stretch the wait past the Pix code, so it only restarts other timers
  const idleSeconds = waitingPix ? PIX_SECONDS : IDLE_SECONDS
  const idleReset = waitingPix ? 0 : touches
  useEffect(() => {
    if (!idleWatch) return
    const timer = setTimeout(() => setState((s) => flow.openSheet(s, 'idle')), idleSeconds * 1000)
    return () => clearTimeout(timer)
  }, [idleWatch, idleSeconds, idleReset, state.screen])

  const reset = () => setState({ ...flow.START, paymentMethod: onCustomerPhone ? 'pix' : 'card' })

  const refreshMenu = useCallback(() => {
    const id = ++requestId.current
    adapters.menu.load(storeSlug).then(
      (menu) => {
        if (id !== requestId.current) return
        applyMenu(menu)
      },
      () => {},
    )
  }, [adapters.menu, applyMenu, storeSlug])

  useEffect(() => {
    if (state.screen !== 'bag' || state.lines.length === 0) {
      setRecommendations([])
      return
    }
    const cartIds = state.lines.map((l) => l.productId)
    adapters.recommendations
      .getRecommendations(storeSlug, cartIds, sessionId.current)
      .then((res) => setRecommendations(res.items))
      .catch(() => setRecommendations([]))
  }, [state.screen, state.lines, adapters.recommendations, storeSlug])

  const pay = async () => {
    setState(flow.startPaying)
    try {
      const placed = await adapters.orders.place({
        storeSlug,
        lines: state.lines,
        dineIn: state.dineIn,
        paymentMethod: state.paymentMethod,
      })
      setState((s) => flow.paid(s, placed))
    } catch (error) {
      const rejected = error instanceof OrderRejectedError
      if (rejected) void refreshMenu()
      const message = rejected ? error.message : 'Não foi possível registrar o pedido. Tente de novo.'
      setState((s) => flow.failed(s, message))
    }
  }

  if (menuState === 'not-found') {
    if (!onCustomerPhone) {
      return (
        <section role="alert" className="flex flex-1 flex-col items-center justify-center gap-6 bg-cream px-8 text-center text-ink">
          <h1 className="text-title font-bold">Loja não encontrada</h1>
          <p className="max-w-[36ch] text-body text-muted">
            Este totem não está ligado a uma loja cadastrada. Chame o suporte do TOPA.
          </p>
          <button type="button" onClick={loadMenu} className={`${PRIMARY_ACTION} h-20 px-10 text-[22px] phone:px-8`}>
            Tentar de novo
          </button>
          <BrandMark label="por TOPA" className="mt-4 text-caption font-medium" onStaffTaps={onSwitchRole} />
        </section>
      )
    }
    return (
      <section role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 bg-cream px-8 text-center text-ink">
        <h1 className="text-title font-bold">Loja não encontrada</h1>
        <p className="max-w-[36ch] text-body text-muted">
          Confira o endereço ou aproxime o celular novamente do totem.
        </p>
      </section>
    )
  }

  const count = itemCount(state.lines)

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-cream text-ink"
      onPointerDown={onCustomerPhone ? undefined : () => setTouches((t) => t + 1)}
    >
      {state.screen === 'start' && (
        <StartScreen
          storeName={storeName}
          surface={surface}
          serverStatus={onCustomerPhone ? undefined : { mode: adapters.mode, connection: adapters.connection }}
          onBegin={(dineIn) => setState(flow.begin(dineIn, onCustomerPhone ? 'pix' : 'card'))}
          onQueue={onCustomerPhone ? undefined : () => setState(flow.openQueue())}
          onSwitchRole={onSwitchRole}
        />
      )}
      {state.screen === 'queue' && <QueueScreen menuUrl={menuUrl} totemIsTag={adapters.tag.available} onOrderHere={reset} />}
      {/* only an order placed on the customer's phone is paged (and, in demo mode, cooked);
          at the totem the next customer is waiting, and the order waits for the dashboard */}
      {state.screen === 'done' &&
        (onCustomerPhone ? (
          <PagerScreen
            placed={state.placed!}
            orders={adapters.orders}
            buzzer={adapters.buzzer}
            wakeLock={adapters.wakeLock}
            onNewOrder={reset}
          />
        ) : (
          <DoneScreen placed={state.placed!} onNewOrder={reset} />
        ))}
      {shopping && (
        <KioskHeader
          storeName={storeName}
          dineIn={state.dineIn}
          cartEmpty={count === 0}
          locked={state.payment === 'processing'}
          onCancel={() => (count === 0 ? reset() : setState((s) => flow.openSheet(s, 'cancel')))}
        />
      )}
      {state.screen === 'menu' && menuState !== 'ready' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-12 text-center phone:gap-4 phone:px-6">
          {menuState === 'loading' ? (
            <p role="status" className="text-[26px] phone:text-lead">Carregando o cardápio...</p>
          ) : (
            <>
              <p role="alert" className="text-[26px] font-semibold phone:text-lead">Não foi possível carregar o cardápio.</p>
              <button type="button" onClick={loadMenu} className={`${PRIMARY_ACTION} h-20 px-10 text-[22px] phone:px-8`}>
                Tentar de novo
              </button>
            </>
          )}
        </div>
      )}
      {state.screen === 'menu' && menuState === 'ready' && (
        <>
          <MenuScreen
            products={products}
            lines={state.lines}
            category={state.category}
            banner={bannerFor(now(), state.category, state.lines, products)}
            onCategory={(category) => setState((s) => flow.pickCategory(s, category))}
            onAdd={(product) => setState((s) => flow.add(s, product, products))}
            onRemove={(id) => setState((s) => flow.decrement(s, id))}
            onReview={() => setState((s) => flow.show(s, 'bag'))}
            onVoiceOrder={() => setVoiceModalOpen(true)}
          />
          {voiceModalOpen && (
            <VoiceOrderModal
              products={products}
              voiceAdapter={adapters.voice}
              onAddItems={(items) => {
                setState((s) => {
                  let nextState = s
                  for (const item of items) {
                    const product = findProduct(products, item.productId)!
                    for (let i = 0; i < item.quantity; i++) {
                      nextState = flow.add(nextState, product, products)
                    }
                  }
                  return nextState
                })
              }}
              onClose={() => setVoiceModalOpen(false)}
            />
          )}
        </>
      )}
      {state.screen === 'bag' && (
        <BagScreen
          products={products}
          lines={state.lines}
          recommendations={recommendations}
          onIncrement={(id) => setState((s) => flow.increment(s, id))}
          onDecrement={(id) => setState((s) => flow.show(flow.decrement(s, id), 'bag'))}
          onAddRecommendation={(id) => setState((s) => flow.increment(s, id))}
          onBack={() => setState((s) => flow.show(s, 'menu'))}
          onPay={() => setState((s) => flow.show(s, 'payment'))}
        />
      )}
      {state.screen === 'payment' && (
        <PaymentScreen
          totalCents={totalCents(state.lines, products)}
          method={state.paymentMethod}
          payment={state.payment}
          error={state.error}
          surface={surface}
          onMethod={(method) => setState((s) => flow.choosePayment(s, method))}
          onApprove={() => void pay()}
          onDecline={() => setState(flow.declined)}
          onBackToBag={() => setState((s) => flow.show(s, 'bag'))}
        />
      )}
      {state.upsell && (
        <Sheet title={state.upsell.question}>
          <p className="flex items-center gap-2 text-caption font-semibold text-teal">
            <CheckIcon size={24} className="phone:size-5" />
            {findProduct(products, state.justAdded!)!.name} adicionado
          </p>
          <img src={photoOf(findProduct(products, state.upsell.productId)!)} alt="" className="h-[300px] w-full rounded-[24px] object-cover short:h-48 max-sm:h-44 phone:h-36" />
          <h2 className="text-heading leading-tight font-bold">{state.upsell.question}</h2>
          <p className="text-body text-muted phone:leading-snug">{state.upsell.reason}</p>
          <ChoiceButtons
            secondary="Não, obrigado"
            primary={`Adicionar por ${formatBRL(findProduct(products, state.upsell.productId)!.priceCents)}`}
            onSecondary={() => setState(flow.declineUpsell)}
            onPrimary={() => setState(flow.acceptUpsell)}
          />
        </Sheet>
      )}
      {state.sheet === 'cancel' && (
        <Sheet title="Cancelar o pedido?">
          <h2 className="text-heading font-bold">Cancelar o pedido?</h2>
          <p className="text-body text-muted">
            {count === 1 ? 'O item escolhido será removido.' : `Os ${count} itens escolhidos serão removidos.`}
          </p>
          <ChoiceButtons
            secondary="Cancelar pedido"
            primary="Continuar pedido"
            onSecondary={reset}
            onPrimary={() => setState(flow.closeSheet)}
          />
        </Sheet>
      )}
      {state.sheet === 'idle' && <IdleSheet onStay={() => setState(flow.closeSheet)} onLeave={reset} />}
    </div>
  )
}

function IdleSheet({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  const left = useCountdown(IDLE_WARNING_SECONDS, onLeave)
  return (
    <Sheet title="Você ainda está aí?">
      <h2 className="text-heading font-bold">Você ainda está aí?</h2>
      <p className="text-body text-muted tabular-nums">O pedido será cancelado em {left} s.</p>
      <ChoiceButtons secondary="Recomeçar" primary="Continuar" onSecondary={onLeave} onPrimary={onStay} />
    </Sheet>
  )
}
