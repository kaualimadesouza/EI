import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { CustomerAuthPort } from '../../ports/customer-auth'
import { CustomerAuthScreen } from './CustomerAuthScreen'

describe('CustomerAuthScreen', () => {
  it('renders login tab by default and authenticates customer', async () => {
    const user = userEvent.setup()
    const onAuthSuccess = vi.fn()
    const fakeAuth: CustomerAuthPort = {
      login: vi.fn().mockResolvedValue({ id: 'c1', name: 'Maria', email: 'maria@email.com' }),
      loginWithGoogle: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      getToken: vi.fn(),
      getCustomer: vi.fn(),
      init: vi.fn(),
    }

    render(<CustomerAuthScreen auth={fakeAuth} onAuthSuccess={onAuthSuccess} />)

    expect(screen.getByRole('heading', { name: 'Acesse sua conta TOPA' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Entrar' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByLabelText('Nome completo')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('E-mail'), 'maria@email.com')
    await user.type(screen.getByLabelText('Senha'), 'senha123')
    await user.click(screen.getByRole('button', { name: 'Entrar no TOPA' }))

    expect(fakeAuth.login).toHaveBeenCalledWith({ email: 'maria@email.com', password: 'senha123' })
    expect(onAuthSuccess).toHaveBeenCalledWith({ id: 'c1', name: 'Maria', email: 'maria@email.com' })
  })

  it('switches to registration tab and creates account', async () => {
    const user = userEvent.setup()
    const onAuthSuccess = vi.fn()
    const fakeAuth: CustomerAuthPort = {
      login: vi.fn(),
      loginWithGoogle: vi.fn(),
      register: vi.fn().mockResolvedValue({ id: 'c2', name: 'Pedro Santos', email: 'pedro@email.com' }),
      logout: vi.fn(),
      getToken: vi.fn(),
      getCustomer: vi.fn(),
      init: vi.fn(),
    }

    render(<CustomerAuthScreen auth={fakeAuth} onAuthSuccess={onAuthSuccess} />)

    await user.click(screen.getByRole('tab', { name: 'Criar conta' }))
    expect(screen.getByRole('tab', { name: 'Criar conta' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Nome completo')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Nome completo'), 'Pedro Santos')
    await user.type(screen.getByLabelText('E-mail'), 'pedro@email.com')
    await user.type(screen.getByLabelText('Senha'), 'senha123')
    await user.click(screen.getByRole('button', { name: 'Cadastrar e continuar' }))

    expect(fakeAuth.register).toHaveBeenCalledWith({
      name: 'Pedro Santos',
      email: 'pedro@email.com',
      password: 'senha123',
    })
    expect(onAuthSuccess).toHaveBeenCalledWith({ id: 'c2', name: 'Pedro Santos', email: 'pedro@email.com' })
  })

  it('validates password length on registration tab', async () => {
    const user = userEvent.setup()
    const fakeAuth: CustomerAuthPort = {
      login: vi.fn(),
      loginWithGoogle: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      getToken: vi.fn(),
      getCustomer: vi.fn(),
      init: vi.fn(),
    }

    render(<CustomerAuthScreen auth={fakeAuth} onAuthSuccess={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'Criar conta' }))

    await user.type(screen.getByLabelText('Nome completo'), 'Ana')
    await user.type(screen.getByLabelText('E-mail'), 'ana@test.com')
    await user.type(screen.getByLabelText('Senha'), '123')
    await user.click(screen.getByRole('button', { name: 'Cadastrar e continuar' }))

    expect(screen.getByRole('alert')).toHaveTextContent('A senha deve conter no mínimo 6 caracteres.')
    expect(fakeAuth.register).not.toHaveBeenCalled()
  })

  it('displays error alert when login fails', async () => {
    const user = userEvent.setup()
    const fakeAuth: CustomerAuthPort = {
      login: vi.fn().mockRejectedValue(new Error('Credenciais inválidas.')),
      loginWithGoogle: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      getToken: vi.fn(),
      getCustomer: vi.fn(),
      init: vi.fn(),
    }

    render(<CustomerAuthScreen auth={fakeAuth} onAuthSuccess={vi.fn()} />)

    await user.type(screen.getByLabelText('E-mail'), 'bad@test.com')
    await user.type(screen.getByLabelText('Senha'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Entrar no TOPA' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Credenciais inválidas.')

    // Switching tabs clears the error
    await user.click(screen.getByRole('tab', { name: 'Criar conta' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    // Switch back to login tab
    await user.click(screen.getByRole('tab', { name: 'Entrar' }))
    expect(screen.getByRole('tab', { name: 'Entrar' })).toHaveAttribute('aria-selected', 'true')
  })

  it('displays fallback error message when rejected with non-error object', async () => {
    const user = userEvent.setup()
    const fakeAuth: CustomerAuthPort = {
      login: vi.fn().mockRejectedValue('String error'),
      loginWithGoogle: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      getToken: vi.fn(),
      getCustomer: vi.fn(),
      init: vi.fn(),
    }

    render(<CustomerAuthScreen auth={fakeAuth} onAuthSuccess={vi.fn()} />)
    await user.type(screen.getByLabelText('E-mail'), 'bad@test.com')
    await user.type(screen.getByLabelText('Senha'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Entrar no TOPA' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Falha na autenticação.')
  })

  it('authenticates customer via Google SSO button', async () => {
    const user = userEvent.setup()
    const onAuthSuccess = vi.fn()
    const fakeAuth: CustomerAuthPort = {
      login: vi.fn(),
      loginWithGoogle: vi.fn().mockResolvedValue({ id: 'c-google', name: 'Google User', email: 'user@gmail.com' }),
      register: vi.fn(),
      logout: vi.fn(),
      getToken: vi.fn(),
      getCustomer: vi.fn(),
      init: vi.fn(),
    }

    render(<CustomerAuthScreen auth={fakeAuth} onAuthSuccess={onAuthSuccess} />)

    await user.click(screen.getByRole('button', { name: 'Continuar com o Google' }))

    expect(fakeAuth.loginWithGoogle).toHaveBeenCalled()
    expect(onAuthSuccess).toHaveBeenCalledWith({ id: 'c-google', name: 'Google User', email: 'user@gmail.com' })
  })

  it('displays error when Google SSO fails', async () => {
    const user = userEvent.setup()
    const fakeAuth: CustomerAuthPort = {
      login: vi.fn(),
      loginWithGoogle: vi.fn().mockRejectedValue(new Error('Google SSO indisponível.')),
      register: vi.fn(),
      logout: vi.fn(),
      getToken: vi.fn(),
      getCustomer: vi.fn(),
      init: vi.fn(),
    }

    render(<CustomerAuthScreen auth={fakeAuth} onAuthSuccess={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Continuar com o Google' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Google SSO indisponível.')
  })

  it('displays fallback error message when Google SSO rejects with non-Error object', async () => {
    const user = userEvent.setup()
    const fakeAuth: CustomerAuthPort = {
      login: vi.fn(),
      loginWithGoogle: vi.fn().mockRejectedValue('SSO unexpected failure'),
      register: vi.fn(),
      logout: vi.fn(),
      getToken: vi.fn(),
      getCustomer: vi.fn(),
      init: vi.fn(),
    }

    render(<CustomerAuthScreen auth={fakeAuth} onAuthSuccess={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Continuar com o Google' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao autenticar com o Google.')
  })
})
