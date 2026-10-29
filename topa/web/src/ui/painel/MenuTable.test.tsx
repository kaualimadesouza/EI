import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { OrderSummary } from '../../domain/order'
import type { Product } from '../../domain/menu'
import { MenuTable } from './MenuTable'

const products: Product[] = [
  {
    id: 'coxinha',
    name: 'Coxinha',
    description: 'Frango desfiado.',
    category: 'salgados',
    priceCents: 750,
    available: true,
  },
  {
    id: 'pastel',
    name: 'Pastel Especial',
    description: 'Carne e queijo.',
    category: 'especiais',
    priceCents: 900,
    available: false,
    photoUrl: 'https://example.com/pastel.jpg',
  },
]

const orders: OrderSummary[] = [
  {
    id: 'ord-1',
    number: 1,
    status: 'delivered',
    dineIn: false,
    paymentMethod: 'card',
    totalCents: 1500,
    createdAt: '2026-10-29T10:00:00Z',
    items: [{ productId: 'coxinha', name: 'Coxinha', quantity: 2, unitPriceCents: 750 }],
  },
]

describe('MenuTable', () => {
  it('renders products across standard and custom categories', () => {
    const onAvailability = vi.fn()
    const onEdit = vi.fn()

    render(
      <MenuTable
        products={products}
        orders={orders}
        onAvailability={onAvailability}
        onEdit={onEdit}
      />,
    )

    expect(screen.getByText('Coxinha')).toBeInTheDocument()
    expect(screen.getByText('Pastel Especial')).toBeInTheDocument()
    expect(screen.getByText('Especiais')).toBeInTheDocument()

    const toggles = screen.getAllByRole('switch')
    expect(toggles).toHaveLength(2)
    fireEvent.click(toggles[0])
    expect(onAvailability).toHaveBeenCalledWith(products[0], false)

    const editButtons = screen.getAllByRole('button', { name: /Editar/ })
    fireEvent.click(editButtons[0])
    expect(onEdit).toHaveBeenCalledWith(products[0])
  })
})
