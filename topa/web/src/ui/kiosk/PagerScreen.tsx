import { type ReactNode, useEffect, useState } from 'react'

import type { OrderSummary, PlacedOrder } from '../../domain/order'
import type { BuzzerPort } from '../../ports/buzzer'
import type { OrdersPort } from '../../ports/orders'
import type { WakeLockPort } from '../../ports/wake-lock'
import { AlertIcon, BellIcon, CheckIcon, ClockIcon } from '../icons'
import { OrderScreen } from './EndScreens'

/** How long the customer's phone waits between two checks on its order. */
export const FOLLOW_MS = 2000

interface PagerView {
  icon: ReactNode
  title: string
  hint: string
  /** The ready call: the phone buzzes and the bell blinks. */
  calling: boolean
}

const PREPARING: PagerView = {
  icon: <ClockIcon size={56} className="phone:size-12" />,
  title: 'Preparando seu pedido',
  hint: 'Avisamos aqui quando ficar pronto. Deixe esta tela aberta.',
  calling: false,
}

// the customer cannot tell received from preparing, and does not need to
const PAGER: Record<OrderSummary['status'], PagerView> = {
  received: PREPARING,
  preparing: PREPARING,
  ready: { icon: <BellIcon size={56} className="phone:size-12" />, title: 'Seu pedido está pronto', hint: 'Retire no balcão.', calling: true },
  delivered: { icon: <CheckIcon size={56} className="phone:size-12" />, title: 'Pedido entregue', hint: 'Obrigado pela preferência.', calling: false },
}

interface PagerScreenProps {
  placed: PlacedOrder
  orders: OrdersPort
  buzzer: BuzzerPort
  wakeLock: WakeLockPort
  onNewOrder: () => void
}

/** The customer's phone as the counter's pager: it follows the order and calls the customer when it is ready. */
export function PagerScreen({ placed, orders, buzzer, wakeLock, onNewOrder }: PagerScreenProps) {
  const [status, setStatus] = useState<OrderSummary['status']>('received')
  const [failing, setFailing] = useState(false)
  const { calling, ...view } = PAGER[status]
  const handedOver = status === 'delivered'

  // one check at a time, so a slow answer never lands after a newer one; it keeps asking after
  // delivery because the counter can undo that step
  useEffect(() => {
    let live = true
    let busy = false
    let timer = setTimeout(check, FOLLOW_MS)
    function check() {
      busy = true
      orders
        .statusOf(placed.id)
        .then(
          (now) => {
            setStatus(now)
            setFailing(false)
          },
          () => setFailing(true),
        )
        .finally(() => {
          busy = false
          if (live) timer = setTimeout(check, FOLLOW_MS)
        })
    }
    // back from the lock screen or another app, where timers stall, it asks at once
    const onVisible = () => {
      if (busy || document.visibilityState !== 'visible') return
      clearTimeout(timer)
      check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      live = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [orders, placed.id])

  useEffect(() => {
    if (calling) buzzer.buzz()
  }, [calling, buzzer])

  // a locked phone neither checks nor buzzes, so the screen stays on until the order is handed over
  useEffect(() => (handedOver ? undefined : wakeLock.hold()), [wakeLock, handedOver])

  return (
    <OrderScreen placed={placed} {...view} calling={calling} onNewOrder={onNewOrder}>
      {failing && (
        <p role="alert" className="flex items-center gap-2 rounded-control bg-warning-tint px-4 py-2 text-caption font-medium text-warning">
          <AlertIcon size={20} />
          Não foi possível atualizar o pedido. Se demorar, procure o balcão.
        </p>
      )}
    </OrderScreen>
  )
}
