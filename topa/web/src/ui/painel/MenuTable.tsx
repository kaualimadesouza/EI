import { CATEGORIES, formatBRL, type Product } from '../../domain/menu'
import type { OrderSummary } from '../../domain/order'
import { SUGGESTION_RULES } from '../../domain/suggest'

interface MenuTableProps {
  products: readonly Product[]
  orders: readonly OrderSummary[]
  onAvailability: (product: Product, available: boolean) => void
}

function soldToday(orders: readonly OrderSummary[]): Map<string, number> {
  const sold = new Map<string, number>()
  for (const order of orders) {
    for (const item of order.items) sold.set(item.productId, (sold.get(item.productId) ?? 0) + item.quantity)
  }
  return sold
}

/** Every product by category, sold-out ones first so the merchant sees what the totems are missing. */
export function MenuTable({ products, orders, onAvailability }: MenuTableProps) {
  const sold = soldToday(orders)

  return (
    <div className="overflow-x-auto rounded-[20px] border border-line bg-white">
      <table className="w-full min-w-[640px] text-left text-[15px]">
        <thead className="text-[13px] text-muted">
          <tr className="border-b border-line">
            <th scope="col" className="px-5 py-3 font-medium">Produto</th>
            <th scope="col" className="px-3 py-3 text-right font-medium">Preço</th>
            <th scope="col" className="px-3 py-3 text-right font-medium">Vendidos hoje</th>
            <th scope="col" className="px-3 py-3 font-medium">Sugestão no totem</th>
            <th scope="col" className="px-5 py-3 text-right font-medium">À venda</th>
          </tr>
        </thead>
        {CATEGORIES.map((category) => {
          const rows = products
            .filter((product) => product.category === category.id)
            .sort((a, b) => Number(a.available) - Number(b.available))
          return (
            <tbody key={category.id} className="border-b border-line last:border-b-0">
              <tr>
                <th scope="rowgroup" colSpan={5} className="bg-ground-2 px-5 py-2 text-[13px] font-semibold">
                  {category.label}
                </th>
              </tr>
              {rows.map((product) => (
                <tr key={product.id} className={product.available ? '' : 'bg-warning-tint'}>
                  <th scope="row" className="px-5 py-3 font-medium">
                    {product.name}
                    {!product.available && <span className="ml-2 text-[13px] font-semibold text-warning">Esgotado</span>}
                  </th>
                  <td className="px-3 py-3 text-right tabular-nums">{formatBRL(product.priceCents)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{sold.get(product.id) ?? 0}</td>
                  <td className={`px-3 py-3 ${SUGGESTION_RULES[product.id] ? '' : 'text-muted'}`}>
                    {SUGGESTION_RULES[product.id] ?? 'Sem regra'}
                  </td>
                  <td className="px-5 py-2 text-right">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={product.available}
                      aria-label={`${product.name} à venda`}
                      onClick={() => onAvailability(product, !product.available)}
                      className={`relative inline-flex h-8 w-14 flex-none items-center rounded-full transition-colors ${
                        product.available ? 'bg-teal' : 'bg-line'
                      }`}
                    >
                      <span
                        className={`absolute size-6 rounded-full bg-white transition-transform ${
                          product.available ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}
