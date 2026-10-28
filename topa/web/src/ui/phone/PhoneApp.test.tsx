import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { createAdapters } from '../../composition'
import type { Adapters } from '../../ports/adapters'
import { PhoneApp } from './PhoneApp'

function phoneAdapters(): Adapters {
  return {
    ...createAdapters(undefined),
    nfc: { scan: () => Promise.resolve({ kind: 'url', url: 'https://topa-totem.vercel.app/?loja=lanchonete-bem-te-vi' }) },
    tag: { available: true, publish: vi.fn(), withdraw: vi.fn() },
  }
}

describe('PhoneApp', () => {
  it('opens the store by itself once the totem is read, and goes back to reading on request', async () => {
    const adapters = phoneAdapters()
    render(<PhoneApp adapters={adapters} />)

    await userEvent.click(screen.getByRole('button', { name: 'Aproximar do totem' }))

    expect(screen.getByRole('heading', { name: 'Peça aqui. Pague aqui.' })).toBeInTheDocument()
    expect(screen.getByText('Lanchonete Bem-te-vi')).toBeInTheDocument()
    expect(adapters.tag.publish).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'A fila está grande? Peça pelo celular' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Ler outro totem' }))

    expect(screen.getByRole('button', { name: 'Aproximar do totem' })).toBeInTheDocument()
    expect(screen.queryByText('Lanchonete Bem-te-vi')).not.toBeInTheDocument()
  })
})
