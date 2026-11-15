export interface Product {
  id: string
  name: string
  description: string
  category: string
  priceCents: number
  available: boolean
  photoUrl?: string
}

export interface Category {
  id: string
  label: string
}

export const CATEGORIES: readonly Category[] = [
  { id: 'combos', label: 'Combos' },
  { id: 'lanches', label: 'Lanches' },
  { id: 'salgados', label: 'Salgados' },
  { id: 'bebidas', label: 'Bebidas' },
  { id: 'doces', label: 'Doces' },
]

export function findProduct(products: readonly Product[], id: string): Product | undefined {
  return products.find((product) => product.id === id)
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** "R$ 12,90"; Intl puts a no-break space after the symbol so prices never wrap. */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100)
}

/** Parses Brazilian Real input ("12,90", "1.234,56", "1234.56") into integer cents. */
export function parseBRL(raw: string): number | null {
  const clean = raw.trim()
  const valid = /^(?:\d+(?:[,.]\d{1,2})?|\d{1,3}(?:\.\d{3})+,\d{1,2})$/.test(clean)
  if (!valid) return null
  const parsed = Number(clean.includes(',') ? clean.replaceAll('.', '').replace(',', '.') : clean)
  const cents = Math.round(parsed * 100)
  return Number.isSafeInteger(cents) ? cents : null
}
