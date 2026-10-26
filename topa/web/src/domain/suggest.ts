import { quantityOf, type CartLine } from './cart'
import { findProduct, type Product } from './menu'

export interface Suggestion {
  productId: string
  reason: string
}

export interface Upsell {
  productId: string
  question: string
  reason: string
}

/** What the menu banner offers at this time of day (store hours, local time). */
export function suggestionAt(now: Date): Suggestion {
  const hour = now.getHours()
  if (hour < 11) return { productId: 'combo-cafe', reason: 'Para o café da manhã.' }
  if (hour < 15) return { productId: 'combo-misto', reason: 'Sai R$ 1,90 mais barato que separado.' }
  return { productId: 'bolo', reason: 'Para acompanhar o café da tarde.' }
}

/** The banner hides when it would repeat a card on screen, the cart already has it, or it sold out. */
export function bannerFor(
  now: Date,
  category: Product['category'],
  lines: readonly CartLine[],
  products: readonly Product[],
): Suggestion | null {
  const suggestion = suggestionAt(now)
  const product = findProduct(products, suggestion.productId)
  if (!product?.available) return null
  if (product.category === category) return null
  if (quantityOf(lines, product.id) > 0) return null
  return suggestion
}

function has(
  lines: readonly CartLine[],
  products: readonly Product[],
  test: (product: Product) => boolean,
): boolean {
  return lines.some((line) => {
    const product = findProduct(products, line.productId)
    return product !== undefined && test(product)
  })
}

/** One offer right after an add: a drink for a sandwich, a pão de queijo for a coffee. */
export function upsellAfterAdding(
  added: Product,
  lines: readonly CartLine[],
  products: readonly Product[],
): Upsell | null {
  const hasDrink = has(lines, products, (p) => p.category === 'bebidas' || p.id === 'combo-misto')
  const hasSnack = has(lines, products, (p) => p.category === 'salgados' || p.id === 'combo-cafe')
  let upsell: Upsell | null = null
  if (added.category === 'lanches' && !hasDrink) {
    upsell = {
      productId: 'suco',
      question: 'Que tal um suco de laranja para acompanhar?',
      reason: 'Natural, 300 ml. Combina com o seu lanche.',
    }
  } else if (added.id === 'cafe' && !hasSnack) {
    upsell = {
      productId: 'paoqueijo',
      question: 'Vai um pão de queijo com o café?',
      reason: 'Porção com três unidades.',
    }
  }
  if (upsell === null || !findProduct(products, upsell.productId)?.available) return null
  return upsell
}
