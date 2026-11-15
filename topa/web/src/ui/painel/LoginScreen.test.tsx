import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AuthError, type AuthenticatedMerchant, type AuthPort } from '../../ports/auth'
import { LoginScreen } from './LoginScreen'

function fakeAuth(overrides?: Partial<AuthPort>): AuthPort {
  return {
    login: vi.fn().mockResolvedValue({
      email: 'admin@bemtevi.topa.com',
      storeSlug: 'lanchonete-bem-te-vi',
    }),
    register: vi.fn().mockResolvedValue({ email: 'dono@example.com', storeSlug: 'restaurante-123' }),
    logout: vi.fn(),
    getToken: vi.fn().mockReturnValue(null),
    getMerchant: vi.fn().mockReturnValue(null),
    ...overrides,
  }
}

describe('LoginScreen', () => {
  it('creates the merchant store and enters its dashboard without a customer account', async () => {
    const user = userEvent.setup()
    const auth = fakeAuth()
    const onLoginSuccess = vi.fn()
    render(<LoginScreen auth={auth} onLoginSuccess={onLoginSuccess} />)
    await user.click(screen.getByRole('button', { name: 'Criar minha loja' }))
    await user.type(screen.getByLabelText('Nome da loja'), 'Restaurante da Esquina')
    await user.type(screen.getByLabelText('E-mail'), 'dono@example.com')
    await user.type(screen.getByLabelText('Senha'), 'senha-local-123')
    await user.type(screen.getByLabelText('Confirme a senha'), 'senha-local-123')
    await user.click(screen.getByRole('button', { name: 'Criar loja e acessar painel' }))
    expect(auth.register).toHaveBeenCalledWith({
      storeName: 'Restaurante da Esquina', email: 'dono@example.com', password: 'senha-local-123',
    })
    expect(onLoginSuccess).toHaveBeenCalledWith({ email: 'dono@example.com', storeSlug: 'restaurante-123' })
    expect(screen.getByRole('link', { name: 'Voltar ao site' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Quero fazer um pedido' })).toHaveAttribute('href', '/pedir')
  })

  it('explains mismatched passwords and lets the owner return to login', async () => {
    const user = userEvent.setup()
    const auth = fakeAuth()
    render(<LoginScreen auth={auth} onLoginSuccess={vi.fn()} startWithRegistration />)
    await user.type(screen.getByLabelText('Nome da loja'), 'Restaurante')
    await user.type(screen.getByLabelText('E-mail'), 'dono@example.com')
    await user.type(screen.getByLabelText('Senha'), 'senha-local-123')
    await user.type(screen.getByLabelText('Confirme a senha'), 'outra-senha-123')
    await user.click(screen.getByRole('button', { name: 'Criar loja e acessar painel' }))
    expect(screen.getByRole('alert')).toHaveTextContent('As senhas não coincidem.')
    expect(auth.register).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Já tenho uma loja' }))
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('renders form inputs, submit button and LGPD notice', () => {
    const auth = fakeAuth()
    render(<LoginScreen auth={auth} onLoginSuccess={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Painel do lojista' })).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(
      screen.getByText(
        /Ao entrar, você concorda com a Política de Privacidade \(LGPD\)\. Seus dados de acesso são utilizados exclusivamente para autenticação e gestão da loja\./,
      ),
    ).toBeInTheDocument()
  })

  it('submits form and calls onLoginSuccess on successful login', async () => {
    const user = userEvent.setup()
    const onLoginSuccess = vi.fn()
    const merchant: AuthenticatedMerchant = {
      email: 'admin@bemtevi.topa.com',
      storeSlug: 'lanchonete-bem-te-vi',
    }
    const auth = fakeAuth({ login: vi.fn().mockResolvedValue(merchant) })

    render(<LoginScreen auth={auth} onLoginSuccess={onLoginSuccess} />)

    await user.type(screen.getByLabelText('E-mail'), 'admin@bemtevi.topa.com')
    await user.type(screen.getByLabelText('Senha'), 'topa123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(auth.login).toHaveBeenCalledWith({
      email: 'admin@bemtevi.topa.com',
      password: 'topa123',
    })
    expect(onLoginSuccess).toHaveBeenCalledWith(merchant)
  })

  it('displays error banner when authentication fails with AuthError', async () => {
    const user = userEvent.setup()
    const auth = fakeAuth({
      login: vi.fn().mockRejectedValue(new AuthError('E-mail ou senha incorretos.')),
    })

    render(<LoginScreen auth={auth} onLoginSuccess={vi.fn()} />)

    await user.type(screen.getByLabelText('E-mail'), 'wrong@topa.com')
    await user.type(screen.getByLabelText('Senha'), 'badpass')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('E-mail ou senha incorretos.')
  })

  it('displays fallback error message when non-Error object is thrown', async () => {
    const user = userEvent.setup()
    const auth = fakeAuth({
      login: vi.fn().mockRejectedValue('network exploded'),
    })

    render(<LoginScreen auth={auth} onLoginSuccess={vi.fn()} />)

    await user.type(screen.getByLabelText('E-mail'), 'wrong@topa.com')
    await user.type(screen.getByLabelText('Senha'), 'badpass')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Falha ao autenticar.')
  })
})
