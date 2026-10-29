import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { createAdapters } from '../../composition'
import { DEMO_CATALOG } from '../../domain/demo-catalog'
import type { Adapters } from '../../ports/adapters'
import { PhoneApp } from './PhoneApp'

function phoneAdapters(): Adapters {
  const base = createAdapters(undefined)
  return {
    ...base,
    menu: {
      load: vi.fn((slug: string) =>
        Promise.resolve({
          store: { slug, name: 'Cantina Central' },
          products: DEMO_CATALOG.map((p) => ({ ...p, available: p.id !== 'coxinha' })),
        }),
      ),
      setAvailability: vi.fn(),
    },
    nfc: { scan: () => Promise.resolve({ kind: 'url', url: 'https://topa-totem.vercel.app/?loja=cantina-central' }) },
    tag: { available: true, publish: vi.fn(), withdraw: vi.fn() },
  }
}

describe('PhoneApp', () => {
  it('opens the scanned store menu once the totem is read, and goes back to reading on request', async () => {
    const adapters = phoneAdapters()
    render(<PhoneApp adapters={adapters} />)

    await userEvent.click(screen.getByRole('button', { name: 'Aproximar do totem' }))

    expect(screen.getByRole('heading', { name: 'Peça aqui. Pague aqui.' })).toBeInTheDocument()
    expect(await screen.findByText('Cantina Central')).toBeInTheDocument()
    expect(adapters.menu.load).toHaveBeenCalledWith('cantina-central')
    expect(adapters.tag.publish).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'A fila está grande? Peça pelo celular' })).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Ler outro totem' }))

    expect(screen.getByRole('button', { name: 'Aproximar do totem' })).toBeInTheDocument()
    expect(screen.queryByText('Cantina Central')).not.toBeInTheDocument()
  })
})
