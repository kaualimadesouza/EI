import { useState, type FormEvent } from 'react'

import type { AuthenticatedCustomer, CustomerAuthPort } from '../../ports/customer-auth'
import { AlertIcon, StoreMark } from '../icons'

export interface CustomerAuthScreenProps {
  auth: CustomerAuthPort
  onAuthSuccess: (customer: AuthenticatedCustomer) => void
}

/** Customer authentication screen with login and registration tabs. */
export function CustomerAuthScreen({ auth, onAuthSuccess }: CustomerAuthScreenProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleTabChange = (nextTab: 'login' | 'register') => {
    setTab(nextTab)
    setError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (tab === 'register' && password.length < 6) {
      setError('A senha deve conter no mínimo 6 caracteres.')
      return
    }

    setLoading(true)

    try {
      if (tab === 'login') {
        const customer = await auth.login({ email, password })
        onAuthSuccess(customer)
      } else {
        const customer = await auth.register({ name: name.trim(), email: email.trim(), password })
        onAuthSuccess(customer)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na autenticação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-cream px-4 py-12 text-ink">
      <div className="w-full max-w-md rounded-[24px] border border-line bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <StoreMark size={48} className="mb-3" />
          <h1 className="text-[24px] font-bold">Acesse sua conta TOPA</h1>
          <p className="mt-1 text-[14px] text-muted">
            Peça no seu restaurante favorito direto pelo navegador.
          </p>
        </div>

        <div className="mb-6 flex rounded-[12px] bg-cream p-1">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'login'}
            onClick={() => handleTabChange('login')}
            className={`flex-1 rounded-[10px] py-2 text-[14px] font-semibold transition-all duration-150 motion-safe:active:scale-95 ${
              tab === 'login' ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'register'}
            onClick={() => handleTabChange('register')}
            className={`flex-1 rounded-[10px] py-2 text-[14px] font-semibold transition-all duration-150 motion-safe:active:scale-95 ${
              tab === 'register' ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            Criar conta
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-[12px] bg-warning-tint px-4 py-3 text-[14px] font-medium text-warning motion-safe:animate-fade-in"
          >
            <AlertIcon size={18} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          {tab === 'register' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="customer-name" className="text-[14px] font-medium">
                Nome completo
              </label>
              <input
                id="customer-name"
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="h-11 rounded-[12px] border border-line bg-white px-3.5 text-[15px] text-ink outline-none transition focus:border-teal"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="customer-email" className="text-[14px] font-medium">
              E-mail
            </label>
            <input
              id="customer-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@exemplo.com"
              className="h-11 rounded-[12px] border border-line bg-white px-3.5 text-[15px] text-ink outline-none transition focus:border-teal"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="customer-password" className="text-[14px] font-medium">
              Senha
            </label>
            <input
              id="customer-password"
              type="password"
              required
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 rounded-[12px] border border-line bg-white px-3.5 text-[15px] text-ink outline-none transition focus:border-teal"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex h-12 w-full cursor-pointer items-center justify-center rounded-[12px] bg-ink text-[16px] font-semibold text-white transition-all duration-150 hover:bg-ink/90 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? 'Carregando...'
              : tab === 'login'
                ? 'Entrar no TOPA'
                : 'Cadastrar e continuar'}
          </button>
        </form>

        <p className="mt-6 text-center text-[12px] leading-relaxed text-muted">
          Ao prosseguir, você concorda com nossos Termos de Uso e Política de Privacidade.
        </p>
      </div>
    </div>
  )
}
