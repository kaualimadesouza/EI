export interface Product {
  id: string
  name: string
  description: string
  category: 'combos' | 'lanches' | 'salgados' | 'bebidas' | 'doces'
  priceCents: number
  available: boolean
}

export interface Category {
  id: Product['category']
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
