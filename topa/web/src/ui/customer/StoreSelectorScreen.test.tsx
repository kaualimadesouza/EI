import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { StoresPort } from '../../ports/stores'
import { StoreSelectorScreen } from './StoreSelectorScreen'

describe('StoreSelectorScreen', () => {
  const customer = { id: 'c1', name: 'Larissa Lima', email: 'larissa@email.com' }

  it('renders greeting and lists restaurants from stores port', async () => {
    const user = userEvent.setup()
    const onSelectStore = vi.fn()
    const onLogout = vi.fn()

    const fakeStores: StoresPort = {
      listAll: vi.fn().mockResolvedValue([
        { slug: 'brasa-burgers', name: 'Brasa Burgers' },
        { slug: 'bella-nonna', name: 'Cantina Bella Nonna' },
        { slug: 'acai-bowls', name: 'Açaí & Bowls Universitário' },
        { slug: 'lanchonete-bem-te-vi', name: 'Lanchonete Bem-te-vi' },
        { slug: 'custom-cafe', name: 'Café do Campus' },
      ]),
    }

    render(
      <StoreSelectorScreen
        stores={fakeStores}
        customer={customer}
        onSelectStore={onSelectStore}
        onLogout={onLogout}
      />,
    )

    expect(screen.getByText('Olá, Larissa Lima')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Brasa Burgers' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cantina Bella Nonna' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Café do Campus' })).toBeInTheDocument()

    // Click on Brasa Burgers
    await user.click(screen.getByRole('button', { name: 'Pedir em Brasa Burgers' }))
    expect(onSelectStore).toHaveBeenCalledWith('brasa-burgers')

    // Click on logout button
    await user.click(screen.getByRole('button', { name: 'Sair da conta' }))
    expect(onLogout).toHaveBeenCalled()
  })

  it('displays error message and allows retrying when loading fails', async () => {
    const user = userEvent.setup()
    const fakeStores: StoresPort = {
      listAll: vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([{ slug: 'brasa-burgers', name: 'Brasa Burgers' }]),
    }

    render(
      <StoreSelectorScreen
        stores={fakeStores}
        customer={customer}
        onSelectStore={vi.fn()}
        onLogout={vi.fn()}
      />,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar a lista de restaurantes.',
    )

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('heading', { name: 'Brasa Burgers' })).toBeInTheDocument()
  })
})
