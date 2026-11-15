import { useState, type FormEvent } from 'react'

import type { AuthenticatedMerchant, AuthPort } from '../../ports/auth'
import { AlertIcon, StoreMark } from '../icons'

export interface LoginScreenProps {
  auth: AuthPort
  storeSlug?: string
  startWithRegistration?: boolean
  onLoginSuccess: (merchant: AuthenticatedMerchant) => void
}

/** Merchant login screen with credentials form and LGPD privacy notice. */
export function LoginScreen({ auth, onLoginSuccess, startWithRegistration = false }: LoginScreenProps) {
  const [registering, setRegistering] = useState(startWithRegistration)
  const [storeName, setStoreName] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (registering && password !== confirmation) {
      setError('As senhas não coincidem.')
      return
    }
    setLoading(true)

    try {
      const credentials = { email: email.trim().toLowerCase(), password }
      const merchant = registering
        ? await auth.register({ ...credentials, storeName: storeName.trim() })
        : await auth.login(credentials)
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
          <h1 className="text-[24px] font-bold">{registering ? 'Crie sua loja no TOPA' : 'Painel do lojista'}</h1>
          <p className="mt-1 text-[14px] text-muted">
            {registering ? 'Comece pelo seu cardápio. Você não precisa ter um totem para cadastrar a loja.' : 'Entre com a conta de lojista para cuidar do cardápio e dos pedidos.'}
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
          {registering && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="store-name" className="text-[14px] font-medium">Nome da loja</label>
              <input id="store-name" required minLength={2} maxLength={100} autoComplete="organization"
                value={storeName} onChange={(event) => setStoreName(event.target.value)}
                placeholder="Ex.: Restaurante da Esquina"
                className="h-12 rounded-[12px] border border-slate bg-white px-3.5 text-[15px] text-ink focus:outline-teal" />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[14px] font-medium">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@seurestaurante.com.br"
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
              autoComplete={registering ? 'new-password' : 'current-password'}
              minLength={registering ? 8 : 1}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 rounded-[12px] border border-line bg-white px-3.5 text-[15px] text-ink outline-none transition focus:border-teal"
            />
          </div>

          {registering && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-password" className="text-[14px] font-medium">Confirme a senha</label>
              <input id="confirm-password" type="password" required autoComplete="new-password"
                value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
                className="h-12 rounded-[12px] border border-slate bg-white px-3.5 text-[15px] text-ink focus:outline-teal" />
              <p className="text-[12px] text-muted">Use uma senha de 8 a 128 caracteres.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-[12px] bg-teal px-3 text-[16px] font-semibold text-white transition hover:bg-slate disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Aguarde...' : registering ? 'Criar loja e acessar painel' : 'Entrar'}
          </button>
        </form>

        <button type="button" disabled={loading} onClick={() => { setRegistering(!registering); setError(null) }}
          className="mt-3 min-h-12 w-full cursor-pointer rounded-[12px] border border-teal px-3 text-[15px] font-semibold text-teal disabled:opacity-50">
          {registering ? 'Já tenho uma loja' : 'Criar minha loja'}
        </button>

        <p className="mt-4 text-center text-[13px] text-muted">O cadastro cria sua conta e seu cardápio. Não contrata um plano nem confirma pagamentos.</p>

        <p className="mt-6 text-center text-[12px] leading-relaxed text-muted">
          Ao entrar, você concorda com a Política de Privacidade (LGPD). Seus dados de acesso
          são utilizados exclusivamente para autenticação e gestão da loja.
        </p>
      </div>
      <nav aria-label="Outros acessos" className="mt-4 flex flex-wrap justify-center gap-4 text-[14px] text-teal">
        <a href={import.meta.env.BASE_URL} className="flex min-h-11 items-center underline">Voltar ao site</a>
        <a href={`${import.meta.env.BASE_URL}pedir`} className="flex min-h-11 items-center underline">Quero fazer um pedido</a>
      </nav>
    </div>
  )
}
