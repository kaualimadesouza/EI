import { itemCount, MAX_QUANTITY, totalCents, type CartLine } from '../../domain/cart'
import { findProduct, formatBRL, type Product } from '../../domain/menu'
import { MinusIcon, PlusIcon, TrashIcon } from '../icons'
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
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-12 py-8 [scrollbar-width:none] short:py-6 max-sm:p-4">
        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6 max-sm:gap-2">
          <h1 className="text-[44px] leading-tight font-bold short:text-[36px] max-sm:text-[30px]">Seu pedido</h1>
          <ul className="flex flex-col divide-y divide-line">
            {lines.map((line) => {
              const product = findProduct(products, line.productId)!
              return (
                <li key={line.productId} className="flex flex-col gap-3 py-6 short:py-4 max-sm:py-4">
                  <div className="flex items-center gap-4 max-sm:gap-3">
                    <img src={photoOf(product.id)} alt="" className="h-[72px] w-24 flex-none rounded-[16px] object-cover max-sm:h-14 max-sm:w-[72px] max-sm:rounded-[12px]" />
                    <span className="line-clamp-2 flex-1 text-[26px] leading-snug font-semibold max-sm:text-[18px]">{product.name}</span>
                    <span className="text-[26px] font-bold tabular-nums max-sm:text-[18px]">{formatBRL(product.priceCents * line.quantity)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[18px] text-muted tabular-nums max-sm:text-[15px]">{formatBRL(product.priceCents)} cada</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onDecrement(product.id)}
                        aria-label={line.quantity === 1 ? `Remover ${product.name}` : `Tirar um ${product.name}`}
                        className="flex h-16 min-w-16 items-center justify-center gap-2 rounded-[16px] border-2 border-slate px-3 text-[18px] font-semibold max-sm:h-14 max-sm:min-w-14 max-sm:text-[16px]"
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
                      <span className="w-10 text-center text-[26px] font-semibold tabular-nums max-sm:w-8 max-sm:text-[20px]">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => onIncrement(product.id)}
                        disabled={line.quantity >= MAX_QUANTITY}
                        aria-label={`Mais um ${product.name}`}
                        className="flex size-16 items-center justify-center rounded-[16px] bg-teal text-white max-sm:size-14"
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
      </div>
      <footer className="flex-none border-t border-line bg-white px-12 py-8 short:py-5 max-sm:p-4">
        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6 short:gap-4 max-sm:gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[26px] max-sm:text-[18px]">Total, {count === 1 ? '1 item' : `${count} itens`}</span>
            <span className="text-[44px] font-bold tabular-nums short:text-[36px] max-sm:text-[30px]">{formatBRL(totalCents(lines, products))}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 max-sm:gap-3">
            <button type="button" onClick={onBack} className="h-24 rounded-[24px] border-2 border-slate px-3 text-[22px] font-semibold short:h-20 max-sm:h-20 max-sm:text-[18px]">
              Continuar comprando
            </button>
            <button type="button" onClick={onPay} className="h-24 rounded-[24px] bg-teal text-[26px] font-semibold text-white short:h-20 max-sm:h-20 max-sm:text-[22px]">
              Pagar
            </button>
          </div>
        </div>
      </footer>
    </>
  )
}
