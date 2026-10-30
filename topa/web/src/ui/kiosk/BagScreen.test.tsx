import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { CartLine } from '../../domain/cart'
import type { Product } from '../../domain/menu'
import type { RecommendationItem } from '../../domain/recommendation'
import { BagScreen } from './BagScreen'

const PRODUCTS: Product[] = [
  {
    id: 'misto',
    name: 'Misto quente',
    description: 'Pão de forma tostado.',
    category: 'lanches',
    priceCents: 1200,
    available: true,
  },
  {
    id: 'suco',
    name: 'Suco de Laranja',
    description: 'Copo de 300 ml.',
    category: 'bebidas',
    priceCents: 800,
    available: true,
  },
]

const LINES: CartLine[] = [
  { productId: 'misto', quantity: 1 },
]

const RECOMMENDATIONS: RecommendationItem[] = [
  {
    productId: 'suco',
    name: 'Suco de Laranja',
    priceCents: 800,
    category: 'bebidas',
    score: 0.95,
    reason: 'Combina com seu lanche.',
  },
]

describe('BagScreen', () => {
  it('renders bag lines, quantities and action buttons', async () => {
    const user = userEvent.setup()
    const onIncrement = vi.fn()
    const onDecrement = vi.fn()
    const onBack = vi.fn()
    const onPay = vi.fn()

    render(
      <BagScreen
        products={PRODUCTS}
        lines={LINES}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
        onBack={onBack}
        onPay={onPay}
      />,
    )

    expect(screen.getByText('Seu pedido')).toBeInTheDocument()
    expect(screen.getByText('Misto quente')).toBeInTheDocument()
    expect(screen.getByText('Remover')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Mais um Misto quente'))
    expect(onIncrement).toHaveBeenCalledWith('misto')

    await user.click(screen.getByLabelText('Remover Misto quente'))
    expect(onDecrement).toHaveBeenCalledWith('misto')

    await user.click(screen.getByRole('button', { name: 'Continuar comprando' }))
    expect(onBack).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Pagar' }))
    expect(onPay).toHaveBeenCalled()
  })

  it('renders recommendations when provided and handles adding', async () => {
    const user = userEvent.setup()
    const onAddRecommendation = vi.fn()

    render(
      <BagScreen
        products={PRODUCTS}
        lines={LINES}
        recommendations={RECOMMENDATIONS}
        onIncrement={vi.fn()}
        onDecrement={vi.fn()}
        onAddRecommendation={onAddRecommendation}
        onBack={vi.fn()}
        onPay={vi.fn()}
      />,
    )

    expect(screen.getByText('Complete seu pedido')).toBeInTheDocument()
    expect(screen.getByText('Combina com seu lanche.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Adicionar Suco de Laranja' }))
    expect(onAddRecommendation).toHaveBeenCalledWith('suco')
  })

  it('filters out recommendations already in cart', () => {
    const linesWithSuco = [
      { productId: 'misto', quantity: 1 },
      { productId: 'suco', quantity: 1 },
    ]

    render(
      <BagScreen
        products={PRODUCTS}
        lines={linesWithSuco}
        recommendations={RECOMMENDATIONS}
        onIncrement={vi.fn()}
        onDecrement={vi.fn()}
        onBack={vi.fn()}
        onPay={vi.fn()}
      />,
    )

    expect(screen.queryByText('Complete seu pedido')).not.toBeInTheDocument()
  })

  it('renders decrement button when quantity > 1', async () => {
    const user = userEvent.setup()
    const onDecrement = vi.fn()
    const linesWithTwo = [{ productId: 'misto', quantity: 2 }]

    render(
      <BagScreen
        products={PRODUCTS}
        lines={linesWithTwo}
        onIncrement={vi.fn()}
        onDecrement={onDecrement}
        onBack={vi.fn()}
        onPay={vi.fn()}
      />,
    )

    await user.click(screen.getByLabelText('Tirar um Misto quente'))
    expect(onDecrement).toHaveBeenCalledWith('misto')
  })
})
