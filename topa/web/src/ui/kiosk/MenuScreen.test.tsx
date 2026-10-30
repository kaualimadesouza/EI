import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Product } from '../../domain/menu'
import { MenuScreen } from './MenuScreen'

const sampleProducts: Product[] = [
  {
    id: 'misto',
    name: 'Misto Quente',
    description: 'Queijo e presunto.',
    category: 'lanches',
    priceCents: 1200,
    available: true,
  },
  {
    id: 'torta',
    name: 'Torta de Limao',
    description: 'Fatia fresca.',
    category: 'sobremesas',
    priceCents: 900,
    available: true,
    photoUrl: 'https://example.com/torta.jpg',
  },
  {
    id: 'esgotado',
    name: 'Suco Natural',
    description: 'Laranja fresca.',
    category: 'bebidas',
    priceCents: 800,
    available: false,
  },
]

describe('MenuScreen', () => {
  it('renders categories including custom categories and banner', () => {
    const onCategory = vi.fn()
    const onAdd = vi.fn()
    const onRemove = vi.fn()
    const onReview = vi.fn()

    render(
      <MenuScreen
        products={sampleProducts}
        lines={[{ productId: 'misto', quantity: 1 }]}
        category="lanches"
        banner={{ productId: 'misto', reason: 'Combina com o almoço.' }}
        onCategory={onCategory}
        onAdd={onAdd}
        onRemove={onRemove}
        onReview={onReview}
      />,
    )

    expect(screen.getByRole('button', { name: /Sobremesas/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Sobremesas/ }))
    expect(onCategory).toHaveBeenCalledWith('sobremesas')

    const bannerBtn = screen.getByRole('button', { name: /^Adicionar Misto Quente por/ })
    fireEvent.click(bannerBtn)
    expect(onAdd).toHaveBeenCalledWith(sampleProducts[0])

    const reviewBtn = screen.getByRole('button', { name: 'Ver pedido' })
    fireEvent.click(reviewBtn)
    expect(onReview).toHaveBeenCalled()
  })

  it('handles active category fallback when given category does not exist in products', () => {
    render(
      <MenuScreen
        products={sampleProducts}
        lines={[]}
        category="categoria-inexistente"
        banner={null}
        onCategory={vi.fn()}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onReview={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Lanches' })).toBeInTheDocument()
    expect(screen.getByText('Toque em um produto para adicionar.')).toBeInTheDocument()
  })

  it('handles empty products menu gracefully', () => {
    render(
      <MenuScreen
        products={[]}
        lines={[]}
        category="vazio"
        banner={null}
        onCategory={vi.fn()}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onReview={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'vazio' })).toBeInTheDocument()
  })

  it('interacts with ProductCard quantity adjustments and sold out items', () => {
    const onAdd = vi.fn()
    const onRemove = vi.fn()

    render(
      <MenuScreen
        products={sampleProducts}
        lines={[
          { productId: 'misto', quantity: 20 },
        ]}
        category="lanches"
        banner={null}
        onCategory={vi.fn()}
        onAdd={onAdd}
        onRemove={onRemove}
        onReview={vi.fn()}
      />,
    )

    const minusBtn = screen.getByRole('button', { name: 'Tirar um Misto Quente' })
    fireEvent.click(minusBtn)
    expect(onRemove).toHaveBeenCalledWith('misto')

    const plusBtn = screen.getByRole('button', { name: 'Mais um Misto Quente' })
    expect(plusBtn).toBeDisabled()
  })

  it('triggers onVoiceOrder when voice order button is clicked', () => {
    const onVoiceOrder = vi.fn()
    render(
      <MenuScreen
        products={sampleProducts}
        lines={[]}
        category="lanches"
        banner={null}
        onCategory={vi.fn()}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onReview={vi.fn()}
        onVoiceOrder={onVoiceOrder}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Pedir por voz' }))
    expect(onVoiceOrder).toHaveBeenCalled()
  })
})
