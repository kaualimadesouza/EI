import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { StoreFound } from './StoreFound'

const store = { slug: 'lanchonete-bauru', url: 'https://topa-totem.vercel.app/?loja=lanchonete-bauru' }

describe('StoreFound', () => {
  it('names the store read from the sticker and links to its menu', () => {
    render(<StoreFound store={store} onScanAgain={vi.fn()} />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Loja encontrada.')
    expect(screen.getByText('lanchonete-bauru')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir cardápio' })).toHaveAttribute('href', store.url)
  })

  it('lets the customer read another sticker', async () => {
    const onScanAgain = vi.fn()
    render(<StoreFound store={store} onScanAgain={onScanAgain} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ler outro adesivo' }))

    expect(onScanAgain).toHaveBeenCalledOnce()
  })
})
