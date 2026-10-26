import { itemCount, totalCents, type CartLine } from '../../domain/cart'
import { findProduct, formatBRL, type Product } from '../../domain/menu'
import { MinusIcon, PlusIcon, TrashIcon } from './icons'
import { photoOf } from './photo'

interface BagScreenProps {
  products: readonly Product[]
  lines: readonly CartLine[]
  onIncrement: (productId: string) => void
  onDecrement: (productId: string) => void
  onBack: () => void
  onPay: () => void
}

export function BagScreen({ products, lines, onIncrement, onDecrement, onBack, onPay }: BagScreenProps) {
  const count = itemCount(lines)
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-12 py-8 [scrollbar-width:none] max-sm:px-4">
        <h1 className="text-[44px] leading-tight font-bold">Seu pedido</h1>
        <ul className="flex flex-col divide-y divide-line">
          {lines.map((line) => {
            const product = findProduct(products, line.productId)!
            return (
              <li key={line.productId} className="flex flex-col gap-3 py-6">
                <div className="flex items-center gap-4">
                  <img src={photoOf(product.id)} alt="" className="h-[72px] w-24 flex-none rounded-[16px] object-cover" />
                  <span className="line-clamp-2 flex-1 text-[26px] leading-snug font-semibold">{product.name}</span>
                  <span className="text-[26px] font-bold tabular-nums">{formatBRL(product.priceCents * line.quantity)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[18px] text-muted tabular-nums">{formatBRL(product.priceCents)} cada</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onDecrement(product.id)}
                      aria-label={line.quantity === 1 ? `Remover ${product.name}` : `Tirar um ${product.name}`}
                      className="flex h-16 min-w-16 items-center justify-center gap-2 rounded-[16px] border-2 border-slate px-3 text-[18px] font-semibold"
                    >
                      {line.quantity === 1 ? (
                        <>
                          <TrashIcon size={24} />
                          Remover
                        </>
                      ) : (
                        <MinusIcon size={24} />
                      )}
                    </button>
                    <span className="w-10 text-center text-[26px] font-semibold tabular-nums">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => onIncrement(product.id)}
                      aria-label={`Mais um ${product.name}`}
                      className="flex size-16 items-center justify-center rounded-[16px] bg-teal text-white"
                    >
                      <PlusIcon size={24} />
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
      <footer className="flex flex-none flex-col gap-6 border-t border-line bg-white px-12 py-8 max-sm:px-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[26px]">Total, {count === 1 ? '1 item' : `${count} itens`}</span>
          <span className="text-[44px] font-bold tabular-nums">{formatBRL(totalCents(lines, products))}</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button type="button" onClick={onBack} className="h-24 rounded-[24px] border-2 border-slate text-[22px] font-semibold">
            Continuar comprando
          </button>
          <button type="button" onClick={onPay} className="h-24 rounded-[24px] bg-teal text-[26px] font-semibold text-white">
            Pagar
          </button>
        </div>
      </footer>
    </>
  )
}
