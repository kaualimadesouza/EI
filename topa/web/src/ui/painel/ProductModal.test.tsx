import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '../../domain/menu'
import { ProductModal } from './ProductModal'

afterEach(() => cleanup())

const SAMPLE_PRODUCT: Product = {
  id: 'coxinha',
  name: 'Coxinha',
  description: 'Frango.',
  category: 'salgados',
  priceCents: 890,
  photoUrl: 'https://example.com/coxinha.jpg',
  available: true,
}

describe('ProductModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ProductModal product={null} isOpen={false} onClose={vi.fn()} onSave={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders new product form and closes on cancel', async () => {
    const onClose = vi.fn()
    render(<ProductModal product={null} isOpen={true} onClose={onClose} onSave={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Novo produto' })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('populates fields for editing and submits changes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(
      <ProductModal
        product={SAMPLE_PRODUCT}
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Editar produto' })).toBeDefined()
    expect(screen.getByLabelText('Nome')).toHaveValue('Coxinha')
    expect(screen.getByLabelText('Preço (R$)')).toHaveValue('8,90')

    await userEvent.clear(screen.getByLabelText('Nome'))
    await userEvent.type(screen.getByLabelText('Nome'), 'Coxinha Especial')
    await userEvent.clear(screen.getByLabelText('Preço (R$)'))
    await userEvent.type(screen.getByLabelText('Preço (R$)'), '10,50')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Coxinha Especial',
        category: 'salgados',
        priceCents: 1050,
      }),
    )
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('validates empty name, empty category, and invalid price', async () => {
    const onSave = vi.fn()
    render(<ProductModal product={null} isOpen={true} onClose={vi.fn()} onSave={onSave} />)

    // Clear and submit with empty name
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o nome do produto.')

    await userEvent.type(screen.getByLabelText('Nome'), 'Pastel')
    await userEvent.clear(screen.getByLabelText('Categoria'))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Informe a categoria.')

    await userEvent.type(screen.getByLabelText('Categoria'), 'salgados')
    await userEvent.type(screen.getByLabelText('Preço (R$)'), 'invalido')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um preço válido.')

    expect(onSave).not.toHaveBeenCalled()
  })

  it('displays error message when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Erro no servidor.'))
    render(<ProductModal product={null} isOpen={true} onClose={vi.fn()} onSave={onSave} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Pastel')
    await userEvent.type(screen.getByLabelText('Preço (R$)'), '9,00')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro no servidor.')
  })

  it('handles non-Error rejection in onSave', async () => {
    const onSave = vi.fn().mockRejectedValue('falha')
    render(<ProductModal product={null} isOpen={true} onClose={vi.fn()} onSave={onSave} />)

    await userEvent.type(screen.getByLabelText('Nome'), 'Pastel')
    await userEvent.type(screen.getByLabelText('Preço (R$)'), '9,00')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar o produto.')
  })
})
