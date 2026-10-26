import { itemCount, MAX_QUANTITY, quantityOf, totalCents, type CartLine } from '../../domain/cart'
import { CATEGORIES, findProduct, formatBRL, type Product } from '../../domain/menu'
import type { Suggestion } from '../../domain/suggest'
import { CategoryIcon, MinusIcon, PlusIcon } from '../icons'
import { photoOf } from './photo'

interface MenuScreenProps {
  products: readonly Product[]
  lines: readonly CartLine[]
  category: Product['category']
  banner: Suggestion | null
  onCategory: (category: Product['category']) => void
  onAdd: (product: Product) => void
  onRemove: (productId: string) => void
  onReview: () => void
}

export function MenuScreen(props: MenuScreenProps) {
  const { products, lines, category, banner, onCategory, onAdd, onRemove, onReview } = props
  const label = CATEGORIES.find((c) => c.id === category)!.label
  const bannerProduct = banner ? findProduct(products, banner.productId) : undefined
  const count = itemCount(lines)

  return (
    <>
      <div className="flex min-h-0 flex-1 max-sm:flex-col">
        <nav
          aria-label="Categorias"
          className="flex w-[168px] flex-none flex-col gap-2 overflow-y-auto bg-ground-2 px-3 py-6 [scrollbar-width:none] short:py-3 max-sm:w-full max-sm:flex-row max-sm:overflow-x-auto max-sm:px-4 max-sm:py-3"
        >
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={c.id === category}
              onClick={() => onCategory(c.id)}
              className={`flex h-28 flex-none flex-col items-center justify-center gap-2 rounded-[24px] text-[18px] short:h-20 short:gap-1 max-sm:h-12 max-sm:flex-row max-sm:rounded-full max-sm:px-4 max-sm:text-[16px] ${
                c.id === category ? 'bg-teal font-semibold text-white' : 'font-medium text-ink'
              }`}
            >
              <CategoryIcon category={c.id} />
              {c.label}
            </button>
          ))}
        </nav>
        <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-8 py-8 [scrollbar-width:none] short:gap-6 short:py-6 max-sm:gap-4 max-sm:p-4">
          <div className="flex flex-col gap-8 short:gap-6 max-sm:gap-4 lg:landscape:flex-row lg:landscape:items-center lg:landscape:justify-between">
            <h1 className="text-[44px] leading-tight font-bold short:text-[36px] max-sm:text-[30px]">{label}</h1>
            {banner && bannerProduct && (
              <button
                type="button"
                onClick={() => onAdd(bannerProduct)}
                aria-label={`Adicionar ${bannerProduct.name} por ${formatBRL(bannerProduct.priceCents)}`}
                className="flex h-[120px] flex-none items-center gap-4 rounded-[24px] bg-teal p-[15px] text-left text-white max-sm:h-auto max-sm:gap-3 max-sm:p-3 lg:landscape:w-[min(100%,640px)]"
              >
                <img src={photoOf(bannerProduct.id)} alt="" className="h-[90px] w-[120px] flex-none rounded-[16px] object-cover max-sm:h-16 max-sm:w-20 max-sm:rounded-[12px]" />
                <span className="flex min-w-0 flex-1 flex-col gap-1 max-sm:gap-0">
                  <span className="text-[18px] text-on-teal max-sm:hidden">Sugestão para agora</span>
                  <span className="truncate text-[22px] font-semibold max-sm:line-clamp-2 max-sm:text-[18px] max-sm:leading-tight max-sm:whitespace-normal">{bannerProduct.name}</span>
                  <span className="truncate text-[18px] text-on-teal max-sm:hidden">{banner.reason}</span>
                </span>
                <span className="flex h-16 flex-none items-center gap-2 rounded-full bg-white px-5 text-[22px] font-semibold text-teal tabular-nums max-sm:h-12 max-sm:gap-1 max-sm:px-3 max-sm:text-[18px]">
                  <PlusIcon size={24} />
                  {formatBRL(bannerProduct.priceCents)}
                </span>
              </button>
            )}
          </div>
          <ul className="grid grid-cols-2 items-start gap-6 max-sm:gap-3 lg:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] short:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {products
              .filter((p) => p.category === category)
              .map((product) => (
                <li key={product.id}>
                  <ProductCard
                    product={product}
                    quantity={quantityOf(lines, product.id)}
                    onAdd={() => onAdd(product)}
                    onRemove={() => onRemove(product.id)}
                  />
                </li>
              ))}
          </ul>
        </div>
      </div>
      <footer className="flex h-32 flex-none items-center justify-between gap-6 border-t border-line bg-white px-12 short:h-24 max-sm:h-24 max-sm:gap-4 max-sm:px-4">
        <div className="flex min-w-0 flex-col">
          {count === 0 ? (
            <span className="text-[22px] text-muted max-sm:text-[16px]">Toque em um produto para adicionar.</span>
          ) : (
            <>
              <span className="text-[32px] font-bold tabular-nums max-sm:text-[24px]">{formatBRL(totalCents(lines, products))}</span>
              <span className="text-[18px] text-muted max-sm:text-[16px]">{count === 1 ? '1 item' : `${count} itens`}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onReview}
          disabled={count === 0}
          className="h-20 flex-none rounded-[24px] bg-teal px-10 text-[26px] font-semibold text-white disabled:bg-line disabled:text-muted short:h-16 max-sm:h-16 max-sm:px-6 max-sm:text-[20px]"
        >
          Ver pedido
        </button>
      </footer>
    </>
  )
}

interface ProductCardProps {
  product: Product
  quantity: number
  onAdd: () => void
  onRemove: () => void
}

function ProductCard({ product, quantity, onAdd, onRemove }: ProductCardProps) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[24px] border border-line bg-white">
      <button
        type="button"
        onClick={onAdd}
        disabled={!product.available}
        aria-label={product.available ? `Adicionar ${product.name}` : `${product.name}, esgotado`}
        className="flex flex-1 flex-col text-left"
      >
        <span className="relative block">
          <img
            src={photoOf(product.id)}
            alt=""
            loading="lazy"
            className={`aspect-[4/3] w-full object-cover lg:landscape:aspect-[16/10] ${product.available ? '' : 'opacity-40'}`}
          />
          {quantity > 0 && (
            <span className="absolute top-3 right-3 flex size-12 items-center justify-center rounded-full bg-teal text-[22px] font-bold text-white ring-[3px] ring-white tabular-nums max-sm:top-2 max-sm:right-2 max-sm:size-9 max-sm:text-[17px]">
              {quantity}
            </span>
          )}
        </span>
        <span className="flex flex-1 flex-col gap-2 p-4 max-sm:gap-1 max-sm:p-3">
          <span className="line-clamp-2 min-h-[2lh] text-[22px] leading-snug font-semibold max-sm:text-[17px]">{product.name}</span>
          <span className="line-clamp-2 min-h-[2lh] text-[18px] text-muted max-sm:text-[14px]">{product.description}</span>
          <span className="mt-auto flex items-center justify-between gap-2 pt-2">
            <span className="text-[26px] font-bold tabular-nums max-sm:text-[19px]">{formatBRL(product.priceCents)}</span>
            {product.available ? (
              <span className="flex size-16 flex-none items-center justify-center rounded-full bg-teal text-white max-sm:size-11">
                <PlusIcon />
              </span>
            ) : (
              <span className="rounded-full bg-warning-tint px-3 py-1 text-[18px] font-semibold text-warning max-sm:px-2 max-sm:text-[14px]">Esgotado</span>
            )}
          </span>
        </span>
      </button>
      {quantity > 0 && (
        <div className="flex h-16 items-center justify-between border-t border-line px-2 max-sm:px-0">
          <button type="button" onClick={onRemove} aria-label={`Tirar um ${product.name}`} className="flex size-16 items-center justify-center max-sm:w-14">
            <MinusIcon />
          </button>
          <span aria-label={`${quantity} no pedido`} className="text-[26px] font-bold tabular-nums">{quantity}</span>
          <button type="button" onClick={onAdd} disabled={quantity >= MAX_QUANTITY} aria-label={`Mais um ${product.name}`} className="flex size-16 items-center justify-center disabled:opacity-40 max-sm:w-14">
            <PlusIcon />
          </button>
        </div>
      )}
    </article>
  )
}
