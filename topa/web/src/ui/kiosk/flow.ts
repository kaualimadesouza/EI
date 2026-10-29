import { addOne, removeOne, type CartLine } from '../../domain/cart'
import { findProduct, type Product } from '../../domain/menu'
import type { PlacedOrder } from '../../domain/order'
import { upsellAfterAdding, type Upsell } from '../../domain/suggest'

/** Everything the kiosk screens show; each transition below is a pure function of it. */
export interface KioskState {
  screen: 'start' | 'menu' | 'bag' | 'payment' | 'done' | 'queue'
  dineIn: boolean
  lines: CartLine[]
  category: string
  justAdded: string | null
  upsell: Upsell | null
  upsellOffered: boolean
  paymentMethod: 'card' | 'pix'
  payment: 'choosing' | 'processing' | 'declined' | 'failed'
  error: string | null
  placed: PlacedOrder | null
  sheet: 'none' | 'cancel' | 'idle'
}

export const START: KioskState = {
  screen: 'start',
  dineIn: true,
  lines: [],
  category: 'lanches',
  justAdded: null,
  upsell: null,
  upsellOffered: false,
  paymentMethod: 'card',
  payment: 'choosing',
  error: null,
  placed: null,
  sheet: 'none',
}

export function begin(dineIn: boolean, paymentMethod: 'card' | 'pix' = 'card'): KioskState {
  return { ...START, screen: 'menu', dineIn, paymentMethod }
}

export function openQueue(): KioskState {
  return { ...START, screen: 'queue' }
}

export function pickCategory(state: KioskState, category: string): KioskState {
  return { ...state, category }
}

/** One upsell per order: after the first offer, adds never interrupt again. */
export function add(state: KioskState, product: Product, products: readonly Product[]): KioskState {
  const lines = addOne(state.lines, product.id)
  if (state.upsellOffered) return { ...state, lines, justAdded: product.id }
  const upsell = upsellAfterAdding(product, lines, products)
  return { ...state, lines, justAdded: product.id, upsell, upsellOffered: upsell !== null }
}

export function acceptUpsell(state: KioskState): KioskState {
  if (state.upsell === null) return state
  return { ...state, lines: addOne(state.lines, state.upsell.productId), upsell: null }
}

export function declineUpsell(state: KioskState): KioskState {
  return { ...state, upsell: null }
}

export function increment(state: KioskState, productId: string): KioskState {
  return { ...state, lines: addOne(state.lines, productId) }
}

export function decrement(state: KioskState, productId: string): KioskState {
  return { ...state, lines: removeOne(state.lines, productId) }
}

/** An empty cart cannot reach the bag or the payment. */
export function show(state: KioskState, screen: 'menu' | 'bag' | 'payment'): KioskState {
  if (screen !== 'menu' && state.lines.length === 0) return { ...state, screen: 'menu' }
  return { ...state, screen, payment: 'choosing', error: null }
}

export function choosePayment(state: KioskState, paymentMethod: 'card' | 'pix'): KioskState {
  return { ...state, paymentMethod, payment: 'choosing', error: null }
}

export function startPaying(state: KioskState): KioskState {
  return { ...state, payment: 'processing', error: null }
}

export function paid(state: KioskState, placed: PlacedOrder): KioskState {
  return { ...state, screen: 'done', placed, payment: 'choosing', sheet: 'none' }
}

export function declined(state: KioskState): KioskState {
  return { ...state, payment: 'declined' }
}

export function failed(state: KioskState, message: string): KioskState {
  return { ...state, payment: 'failed', error: message }
}

export function openSheet(state: KioskState, sheet: 'cancel' | 'idle'): KioskState {
  return { ...state, sheet, upsell: null }
}

export function closeSheet(state: KioskState): KioskState {
  return { ...state, sheet: 'none' }
}

/** Drops cart lines whose product sold out or left the menu since they were added. */
export function pruneUnavailable(state: KioskState, products: readonly Product[]): KioskState {
  const lines = state.lines.filter((line) => findProduct(products, line.productId)?.available)
  if (lines.length === state.lines.length) return state
  // an empty cart cannot stay on the bag or the payment
  return { ...state, lines, screen: lines.length === 0 ? 'menu' : state.screen }
}
