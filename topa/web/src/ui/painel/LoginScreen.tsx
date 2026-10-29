import { useState, type FormEvent } from 'react'

import type { AuthenticatedMerchant, AuthPort } from '../../ports/auth'
import { AlertIcon, StoreMark } from '../icons'

export interface LoginScreenProps {
  auth: AuthPort
  storeSlug?: string
  onLoginSuccess: (merchant: AuthenticatedMerchant) => void
}

/** Merchant login screen with credentials form and LGPD privacy notice. */
export function LoginScreen({ auth, onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const merchant = await auth.login({ email, password })
      onLoginSuccess(merchant)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao autenticar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-cream px-4 py-12 text-ink">
      <div className="w-full max-w-md rounded-[24px] border border-line bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <StoreMark size={48} className="mb-3" />
          <h1 className="text-[24px] font-bold">Painel do lojista</h1>
          <p className="mt-1 text-[14px] text-muted">
            Informe suas credenciais para acessar a gestão da loja.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-[12px] bg-warning-tint px-4 py-3 text-[14px] font-medium text-warning"
          >
            <AlertIcon size={18} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[14px] font-medium">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@bemtevi.topa.com"
              className="h-11 rounded-[12px] border border-line bg-white px-3.5 text-[15px] text-ink outline-none transition focus:border-teal"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-[14px] font-medium">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 rounded-[12px] border border-line bg-white px-3.5 text-[15px] text-ink outline-none transition focus:border-teal"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex h-12 w-full cursor-pointer items-center justify-center rounded-[12px] bg-ink text-[16px] font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-[12px] leading-relaxed text-muted">
          Ao entrar, você concorda com a Política de Privacidade (LGPD). Seus dados de acesso
          são utilizados exclusivamente para autenticação e gestão da loja.
        </p>
      </div>
    </div>
  )
}
