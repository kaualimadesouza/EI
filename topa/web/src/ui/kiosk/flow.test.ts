import { describe, expect, it } from 'vitest'

import { DEMO_CATALOG } from '../../domain/demo-catalog'
import { findProduct, type Product } from '../../domain/menu'
import {
  acceptUpsell,
  add,
  begin,
  choosePayment,
  closeSheet,
  declined,
  declineUpsell,
  decrement,
  failed,
  increment,
  openQueue,
  openSheet,
  paid,
  pickCategory,
  pruneUnavailable,
  show,
  START,
  startPaying,
} from './flow'

const product = (id: string): Product => findProduct(DEMO_CATALOG, id)!

describe('kiosk flow', () => {
  it('starts an order on the menu with the dine-in and payment choice', () => {
    expect(begin(false)).toEqual({ ...START, screen: 'menu', dineIn: false })
    expect(begin(true, 'pix')).toEqual({ ...START, screen: 'menu', dineIn: true, paymentMethod: 'pix' })
    expect(openQueue().screen).toBe('queue')
  })

  it('switches categories', () => {
    expect(pickCategory(begin(true), 'doces').category).toBe('doces')
  })

  it('offers an upsell after the first sandwich and then never again', () => {
    const first = add(begin(true), product('misto'), DEMO_CATALOG)
    const declinedOnce = declineUpsell(first)
    const second = add(declinedOnce, product('bauru'), DEMO_CATALOG)

    expect(first.upsell?.productId).toBe('suco')
    expect(first.upsellOffered).toBe(true)
    expect(declinedOnce.upsell).toBeNull()
    expect(second.upsell).toBeNull()
    expect(second.lines).toHaveLength(2)
  })

  it('keeps the offer available when an add has nothing to offer', () => {
    const state = add(begin(true), product('bolo'), DEMO_CATALOG)

    expect(state.upsell).toBeNull()
    expect(state.upsellOffered).toBe(false)
  })

  it('adds the offered product when the customer accepts', () => {
    const accepted = acceptUpsell(add(begin(true), product('misto'), DEMO_CATALOG))

    expect(accepted.upsell).toBeNull()
    expect(accepted.lines).toEqual([
      { productId: 'misto', quantity: 1 },
      { productId: 'suco', quantity: 1 },
    ])
    expect(acceptUpsell(begin(true))).toEqual(begin(true))
  })

  it('changes quantities from the bag', () => {
    const state = increment(begin(true), 'cafe')

    expect(increment(state, 'cafe').lines).toEqual([{ productId: 'cafe', quantity: 2 }])
    expect(decrement(state, 'cafe').lines).toEqual([])
  })

  it('moves between menu, bag and payment, never with an empty cart', () => {
    const empty = begin(true)
    const withItem = increment(empty, 'cafe')

    expect(show(empty, 'bag').screen).toBe('menu')
    expect(show(empty, 'payment').screen).toBe('menu')
    expect(show(withItem, 'bag').screen).toBe('bag')
    expect(show(failed(withItem, 'x'), 'payment')).toMatchObject({ screen: 'payment', payment: 'choosing', error: null })
    expect(show(withItem, 'menu').screen).toBe('menu')
  })

  it('walks the payment states', () => {
    const paying = show(increment(begin(true), 'cafe'), 'payment')

    expect(choosePayment(paying, 'pix')).toMatchObject({ paymentMethod: 'pix', payment: 'choosing' })
    expect(startPaying(paying).payment).toBe('processing')
    expect(declined(startPaying(paying)).payment).toBe('declined')
    expect(failed(startPaying(paying), 'Coxinha esgotou.')).toMatchObject({ payment: 'failed', error: 'Coxinha esgotou.' })
    const placed = { id: 'o47', number: 47, totalCents: 550 }
    expect(paid(startPaying(paying), placed)).toMatchObject({
      screen: 'done',
      placed,
      payment: 'choosing',
    })
  })

  it('opens and closes the cancel and idle sheets', () => {
    expect(openSheet(begin(true), 'cancel').sheet).toBe('cancel')
    expect(closeSheet(openSheet(begin(true), 'idle')).sheet).toBe('none')
  })

  it('shows one overlay at a time: a sheet takes the place of an open suggestion', () => {
    const offered = add(begin(true), product('xsalada'), DEMO_CATALOG)

    expect(offered.upsell).not.toBeNull()
    expect(openSheet(offered, 'idle')).toMatchObject({ sheet: 'idle', upsell: null })
  })

  it('drops cart lines that sold out, and keeps the same state when nothing changed', () => {
    const state = increment(increment(begin(true), 'coxinha'), 'cafe')
    const soldOut = DEMO_CATALOG.map((p) => (p.id === 'coxinha' ? { ...p, available: false } : p))

    expect(pruneUnavailable(state, soldOut).lines).toEqual([{ productId: 'cafe', quantity: 1 }])
    expect(pruneUnavailable(state, DEMO_CATALOG)).toBe(state)
  })
})
