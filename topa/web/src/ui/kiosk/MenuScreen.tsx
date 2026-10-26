import { itemCount, quantityOf, totalCents, type CartLine } from '../../domain/cart'
import { CATEGORIES, findProduct, formatBRL, type Product } from '../../domain/menu'
import type { Suggestion } from '../../domain/suggest'
import { CategoryIcon, MinusIcon, PlusIcon } from './icons'
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
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Categorias" className="flex w-[168px] flex-none flex-col gap-2 bg-ground-2 px-3 py-6 max-sm:w-[104px]">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={c.id === category}
              onClick={() => onCategory(c.id)}
              className={`flex h-28 flex-col items-center justify-center gap-2 rounded-[24px] text-[18px] ${
                c.id === category ? 'bg-teal font-semibold text-white' : 'font-medium text-ink'
              }`}
            >
              <CategoryIcon category={c.id} />
              {c.label}
            </button>
          ))}
        </nav>
        <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-8 py-8 [scrollbar-width:none] max-sm:px-4">
          <h1 className="text-[44px] leading-tight font-bold">{label}</h1>
          {banner && bannerProduct && (
            <button
              type="button"
              onClick={() => onAdd(bannerProduct)}
              aria-label={`Adicionar ${bannerProduct.name} por ${formatBRL(bannerProduct.priceCents)}`}
              className="flex h-[120px] flex-none items-center gap-4 rounded-[24px] bg-teal p-[15px] text-left text-white"
            >
              <img src={photoOf(bannerProduct.id)} alt="" className="h-[90px] w-[120px] flex-none rounded-[16px] object-cover" />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[18px] text-on-teal">Sugestão para agora</span>
                <span className="truncate text-[22px] font-semibold">{bannerProduct.name}</span>
                <span className="truncate text-[18px] text-on-teal">{banner.reason}</span>
              </span>
              <span className="flex h-16 flex-none items-center gap-2 rounded-full bg-white px-5 text-[22px] font-semibold text-teal tabular-nums">
                <PlusIcon size={24} />
                {formatBRL(bannerProduct.priceCents)}
              </span>
            </button>
          )}
          <ul className="grid grid-cols-2 gap-6 max-sm:gap-3">
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
      <footer className="flex h-32 flex-none items-center justify-between gap-6 border-t border-line bg-white px-12 max-sm:px-4">
        <div className="flex flex-col">
          {count === 0 ? (
            <span className="text-[22px] text-muted">Toque em um produto para adicionar.</span>
          ) : (
            <>
              <span className="text-[32px] font-bold tabular-nums">{formatBRL(totalCents(lines, products))}</span>
              <span className="text-[18px] text-muted">{count === 1 ? '1 item' : `${count} itens`}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onReview}
          disabled={count === 0}
          className="h-20 flex-none rounded-[24px] bg-teal px-10 text-[26px] font-semibold text-white disabled:bg-line disabled:text-muted"
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
            className={`aspect-[4/3] w-full object-cover ${product.available ? '' : 'opacity-40'}`}
          />
          {quantity > 0 && (
            <span className="absolute top-3 right-3 flex size-12 items-center justify-center rounded-full bg-teal text-[22px] font-bold text-white ring-[3px] ring-white tabular-nums">
              {quantity}
            </span>
          )}
        </span>
        <span className="flex flex-1 flex-col gap-2 p-4">
          <span className="line-clamp-2 min-h-[2lh] text-[22px] leading-snug font-semibold">{product.name}</span>
          <span className="line-clamp-2 text-[18px] text-muted">{product.description}</span>
          <span className="mt-auto flex items-center justify-between pt-2">
            <span className="text-[26px] font-bold tabular-nums">{formatBRL(product.priceCents)}</span>
            {product.available ? (
              <span className="flex size-16 items-center justify-center rounded-full bg-teal text-white">
                <PlusIcon />
              </span>
            ) : (
              <span className="rounded-full bg-warning-tint px-3 py-1 text-[18px] font-semibold text-warning">Esgotado</span>
            )}
          </span>
        </span>
      </button>
      {quantity > 0 && (
        <div className="flex h-16 items-center justify-between border-t border-line px-2">
          <button type="button" onClick={onRemove} aria-label={`Tirar um ${product.name}`} className="flex size-16 items-center justify-center">
            <MinusIcon />
          </button>
          <span aria-label={`${quantity} no pedido`} className="text-[26px] font-bold tabular-nums">{quantity}</span>
          <button type="button" onClick={onAdd} aria-label={`Mais um ${product.name}`} className="flex size-16 items-center justify-center">
            <PlusIcon />
          </button>
        </div>
      )}
    </article>
  )
}
