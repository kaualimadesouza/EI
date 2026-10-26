import { findProduct, type Product } from './menu'

export interface CartLine {
  productId: string
  quantity: number
}

export function quantityOf(lines: readonly CartLine[], productId: string): number {
  return lines.find((line) => line.productId === productId)?.quantity ?? 0
}

/** Same per-product limit the API enforces when placing an order. */
export const MAX_QUANTITY = 20

export function addOne(lines: readonly CartLine[], productId: string): CartLine[] {
  const current = quantityOf(lines, productId)
  if (current === 0) return [...lines, { productId, quantity: 1 }]
  if (current >= MAX_QUANTITY) return [...lines]
  return lines.map((line) =>
    line.productId === productId ? { productId, quantity: line.quantity + 1 } : line,
  )
}

/** Taking the last unit off removes the line, so a cart never holds zero-quantity lines. */
export function removeOne(lines: readonly CartLine[], productId: string): CartLine[] {
  return lines
    .map((line) =>
      line.productId === productId ? { productId, quantity: line.quantity - 1 } : line,
    )
    .filter((line) => line.quantity > 0)
}

export function itemCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}

export function totalCents(lines: readonly CartLine[], products: readonly Product[]): number {
  return lines.reduce(
    (sum, line) => sum + line.quantity * (findProduct(products, line.productId)?.priceCents ?? 0),
    0,
  )
}
