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

/** How each rule below reads on the dashboard's menu table, keyed by the product it offers. */
export const SUGGESTION_RULES: Readonly<Record<string, string>> = {
  'combo-cafe': 'Banner até as 11h',
  'combo-misto': 'Banner das 11h às 15h',
  bolo: 'Banner a partir das 15h',
  suco: 'Oferecido após um lanche sem bebida',
  paoqueijo: 'Oferecido após um café sem salgado',
}

function selectProduct(
  products: readonly Product[],
  preferredId: string,
  preferredCategory: string,
  defaultReason: string,
  customDefaultReason: string = defaultReason,
  predicate?: (p: Product) => boolean,
): Suggestion {
  if (products.length === 0 || products.some((p) => p.id === preferredId)) {
    return { productId: preferredId, reason: defaultReason }
  }
  const match =
    (predicate ? products.find(predicate) : undefined) ??
    products.find((p) => p.category === preferredCategory) ??
    products[0]
  return { productId: match.id, reason: match.description || customDefaultReason }
}

/** What the menu banner offers at this time of day (store hours, local time). */
export function suggestionAt(now: Date, products: readonly Product[] = []): Suggestion {
  const hour = now.getHours()
  if (hour < 11) {
    return selectProduct(products, 'combo-cafe', 'combos', 'Para o café da manhã.')
  }
  if (hour < 15) {
    return selectProduct(
      products,
      'combo-misto',
      'combos',
      'Sai R$ 1,90 mais barato que separado.',
      'Combo especial para o almoço.',
      (p) => p.category === 'combos' && p.id.includes('almoco'),
    )
  }
  return selectProduct(products, 'bolo', 'doces', 'Para acompanhar o café da tarde.')
}

/** The banner hides when it would repeat a card on screen, the cart already has it, or it sold out. */
export function bannerFor(
  now: Date,
  category: string,
  lines: readonly CartLine[],
  products: readonly Product[],
): Suggestion | null {
  const suggestion = suggestionAt(now, products)
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
  const hasDrink = has(lines, products, (p) => p.category === 'bebidas' || p.category === 'combos' || p.id === 'combo-misto')
  const hasSnack = has(lines, products, (p) => p.category === 'salgados' || p.category === 'combos' || p.id === 'combo-cafe')
  let upsell: Upsell | null = null
  if (added.category === 'lanches' && !hasDrink) {
    const hasDefault = products.some((p) => p.id === 'suco')
    if (hasDefault) {
      upsell = {
        productId: 'suco',
        question: 'Que tal um suco de laranja para acompanhar?',
        reason: 'Natural, 300 ml. Combina com o seu lanche.',
      }
    } else {
      const drink = products.find((p) => p.available && p.category === 'bebidas')
      if (drink) {
        upsell = {
          productId: drink.id,
          question: `Que tal ${drink.name} para acompanhar?`,
          reason: drink.description || 'Combina com o seu lanche.',
        }
      }
    }
  } else if (added.id === 'cafe' && !hasSnack) {
    const hasDefault = products.some((p) => p.id === 'paoqueijo')
    if (hasDefault) {
      upsell = {
        productId: 'paoqueijo',
        question: 'Vai um pão de queijo com o café?',
        reason: 'Porção com três unidades.',
      }
    } else {
      const snack = products.find((p) => p.available && (p.category === 'salgados' || p.category === 'doces'))
      if (snack) {
        upsell = {
          productId: snack.id,
          question: `Vai ${snack.name} para acompanhar?`,
          reason: snack.description || 'Para acompanhar sua bebida.',
        }
      }
    }
  }
  if (upsell === null || !findProduct(products, upsell.productId)?.available) return null
  return upsell
}
