import { useCallback, useEffect, useState } from 'react'

import { itemCount, totalCents } from '../../domain/cart'
import { findProduct, formatBRL, type Product } from '../../domain/menu'
import { phoneMenuUrl } from '../../domain/store'
import { bannerFor } from '../../domain/suggest'
import type { Adapters } from '../../ports/adapters'
import { OrderRejectedError } from '../../ports/orders'
import { BagScreen } from './BagScreen'
import { DoneScreen, QueueScreen } from './EndScreens'
import * as flow from './flow'
import { MenuScreen } from './MenuScreen'
import { ChoiceButtons, KioskHeader, Sheet } from './parts'
import { CheckIcon } from '../icons'
import { PaymentScreen, PIX_SECONDS } from './PaymentScreen'
import { StartScreen } from './StartScreen'
import { photoOf } from './photo'
import { useCountdown } from './use-countdown'

interface KioskAppProps {
  adapters: Adapters
  now?: () => Date
  /** The staff gesture on the TOPA mark; only the Android app has a role to switch. */
  onSwitchRole?: () => void
  /** The kiosk on the customer's own phone (phone app or store link): no tag to serve, no queue to send away. */
  onCustomerPhone?: boolean
}

const IDLE_SECONDS = 45
const IDLE_WARNING_SECONDS = 15

export function KioskApp({ adapters, now = () => new Date(), onSwitchRole, onCustomerPhone = false }: KioskAppProps) {
  const [state, setState] = useState<flow.KioskState>(flow.START)
  const [products, setProducts] = useState<Product[]>([])
  const [menuState, setMenuState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [touches, setTouches] = useState(0)

  const loadMenu = useCallback(() => {
    setMenuState('loading')
    adapters.menu.list().then(
      (list) => {
        setProducts(list)
        setMenuState('ready')
        setState((s) => flow.pruneUnavailable(s, list))
      },
      () => setMenuState('error'),
    )
  }, [adapters.menu])

  // a fresh menu at every new customer picks up what sold out meanwhile
  useEffect(() => {
    if (state.screen === 'start') loadMenu()
  }, [state.screen, loadMenu])

  const menuUrl = phoneMenuUrl(window.location.origin, import.meta.env.BASE_URL)
  // only where a phone is invited to tap: from the menu on, that spot takes the payment card
  const servesTag = !onCustomerPhone && (state.screen === 'start' || state.screen === 'queue')
  useEffect(() => {
    if (!servesTag) return
    adapters.tag.publish(menuUrl)
    return () => adapters.tag.withdraw()
  }, [adapters.tag, menuUrl, servesTag])

  const shopping = ['menu', 'bag', 'payment'].includes(state.screen)
  const idleWatch = shopping && state.sheet !== 'idle' && state.payment !== 'processing'
  const waitingPix = state.screen === 'payment' && state.paymentMethod === 'pix' && state.payment === 'choosing'
  // a touch must not stretch the wait past the Pix code, so it only restarts other timers
  const idleSeconds = waitingPix ? PIX_SECONDS : IDLE_SECONDS
  const idleReset = waitingPix ? 0 : touches
  useEffect(() => {
    if (!idleWatch) return
    const timer = setTimeout(() => setState((s) => flow.openSheet(s, 'idle')), idleSeconds * 1000)
    return () => clearTimeout(timer)
  }, [idleWatch, idleSeconds, idleReset, state.screen])

  const reset = () => setState(flow.START)

  const refreshMenu = () =>
    adapters.menu.list().then(
      (list) => {
        setProducts(list)
        setState((s) => flow.pruneUnavailable(s, list))
      },
      () => {},
    )

  const pay = async () => {
    setState(flow.startPaying)
    try {
      const placed = await adapters.orders.place({
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

  const count = itemCount(state.lines)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-cream text-ink" onPointerDown={() => setTouches((t) => t + 1)}>
      {state.screen === 'start' && (
        <StartScreen
          mode={adapters.mode}
          connection={adapters.connection}
          onBegin={(dineIn) => setState(flow.begin(dineIn))}
          onQueue={onCustomerPhone ? undefined : () => setState(flow.openQueue())}
          onSwitchRole={onSwitchRole}
        />
      )}
      {state.screen === 'queue' && <QueueScreen menuUrl={menuUrl} totemIsTag={adapters.tag.available} onOrderHere={reset} />}
      {state.screen === 'done' && <DoneScreen placed={state.placed!} onNewOrder={reset} />}
      {shopping && (
        <KioskHeader
          dineIn={state.dineIn}
          cartEmpty={count === 0}
          locked={state.payment === 'processing'}
          onCancel={() => (count === 0 ? reset() : setState((s) => flow.openSheet(s, 'cancel')))}
        />
      )}
      {state.screen === 'menu' && menuState !== 'ready' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-12 text-center max-sm:gap-4 max-sm:px-6">
          {menuState === 'loading' ? (
            <p role="status" className="text-[26px] max-sm:text-[18px]">Carregando o cardápio...</p>
          ) : (
            <>
              <p role="alert" className="text-[26px] font-semibold max-sm:text-[18px]">Não foi possível carregar o cardápio.</p>
              <button type="button" onClick={loadMenu} className="h-20 rounded-[24px] bg-teal px-10 text-[22px] font-semibold text-white max-sm:h-16 max-sm:rounded-[20px] max-sm:px-8 max-sm:text-[18px]">
                Tentar de novo
              </button>
            </>
          )}
        </div>
      )}
      {state.screen === 'menu' && menuState === 'ready' && (
        <MenuScreen
          products={products}
          lines={state.lines}
          category={state.category}
          banner={bannerFor(now(), state.category, state.lines, products)}
          onCategory={(category) => setState((s) => flow.pickCategory(s, category))}
          onAdd={(product) => setState((s) => flow.add(s, product, products))}
          onRemove={(id) => setState((s) => flow.decrement(s, id))}
          onReview={() => setState((s) => flow.show(s, 'bag'))}
        />
      )}
      {state.screen === 'bag' && (
        <BagScreen
          products={products}
          lines={state.lines}
          onIncrement={(id) => setState((s) => flow.increment(s, id))}
          onDecrement={(id) => setState((s) => flow.show(flow.decrement(s, id), 'bag'))}
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
          onMethod={(method) => setState((s) => flow.choosePayment(s, method))}
          onApprove={() => void pay()}
          onDecline={() => setState(flow.declined)}
          onBackToBag={() => setState((s) => flow.show(s, 'bag'))}
        />
      )}
      {state.upsell && (
        <Sheet title={state.upsell.question}>
          <p className="flex items-center gap-2 text-[18px] font-semibold text-teal max-sm:text-[15px]">
            <CheckIcon size={24} className="max-sm:size-5" />
            {findProduct(products, state.justAdded!)!.name} adicionado
          </p>
          <img src={photoOf(state.upsell.productId)} alt="" className="h-[300px] w-full rounded-[24px] object-cover short:h-48 max-sm:h-36 max-sm:rounded-[20px]" />
          <h2 className="text-[32px] leading-tight font-bold max-sm:text-[22px]">{state.upsell.question}</h2>
          <p className="text-[22px] text-muted max-sm:text-[16px] max-sm:leading-snug">{state.upsell.reason}</p>
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
          <h2 className="text-[32px] font-bold max-sm:text-[22px]">Cancelar o pedido?</h2>
          <p className="text-[22px] text-muted max-sm:text-[16px]">
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
      <h2 className="text-[32px] font-bold max-sm:text-[22px]">Você ainda está aí?</h2>
      <p className="text-[22px] text-muted tabular-nums max-sm:text-[16px]">O pedido será cancelado em {left} s.</p>
      <ChoiceButtons secondary="Recomeçar" primary="Continuar" onSecondary={onLeave} onPrimary={onStay} />
    </Sheet>
  )
}
