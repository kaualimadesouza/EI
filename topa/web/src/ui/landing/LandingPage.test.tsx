import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LandingPage } from './LandingPage'

describe('TOPA landing page', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_COMMERCIAL_CONTACT_URL', '')
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true
    })
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false
    })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('introduces the subscription and links to the existing customer and merchant experiences', () => {
    render(<LandingPage />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Seu próximo pedido começa com um toque.',
    )
    expect(screen.getByRole('link', { name: 'Abrir cardápio' })).toHaveAttribute('href', '/pedir')
    expect(screen.getByRole('link', { name: 'Explorar cardápio' })).toHaveAttribute('href', '/pedir')
    expect(screen.getByRole('link', { name: 'Acessar painel' })).toHaveAttribute('href', '/painel')
    expect(screen.getByRole('link', { name: 'Ver planos' })).toHaveAttribute('href', '#planos')
    expect(screen.getByText('Projeto acadêmico · EACH/USP · Grupo T94')).toBeInTheDocument()
  })

  it('lets the visitor explore the totem, phone and merchant workflows', async () => {
    const user = userEvent.setup()
    render(<LandingPage />)

    expect(screen.getByRole('button', { name: 'No totem' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('img', { name: 'Cardápio do TOPA no totem' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'No celular' }))
    expect(screen.getByRole('button', { name: 'No celular' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('img', { name: 'Cardápio do TOPA no navegador do celular' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Na sua gestão' }))
    expect(
      screen.getByRole('img', { name: 'Painel do TOPA com pedidos de demonstração' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'No totem' }))
    expect(screen.getByRole('button', { name: 'Na sua gestão' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('presents three proposed plans without inventing checkout or a free trial', () => {
    render(<LandingPage />)

    const plans = screen.getByRole('region', { name: 'Um plano para o seu momento.' })
    for (const name of ['Digital', 'Completo', 'Redes']) {
      expect(within(plans).getByRole('heading', { name })).toBeInTheDocument()
    }
    expect(within(plans).getByText(/249,00/)).toBeInTheDocument()
    expect(within(plans).getAllByText('Sob consulta')).toHaveLength(2)
    expect(within(plans).getByText(/Valores propostos para o piloto/)).toBeInTheDocument()
    for (const link of within(plans).getAllByRole('link', { name: /Criar minha loja/ })) {
      expect(link).toHaveAttribute('href', '/painel?cadastro=1')
    }
    expect(screen.queryByText(/teste grátis|clientes satisfeitos|mais vendido/i)).not.toBeInTheDocument()
  })

  it('uses the configured commercial destination for proposal requests', () => {
    render(<LandingPage contactUrl="mailto:comercial@example.com" />)

    const links = screen.getAllByRole('link', { name: /Solicitar proposta/ })
    expect(links).toHaveLength(4)
    for (const link of links) expect(link).toHaveAttribute('href', 'mailto:comercial@example.com')
  })

  it('opens and closes the mobile navigation and closes it after choosing a section', async () => {
    const user = userEvent.setup()
    render(<LandingPage />)

    const toggle = screen.getByRole('button', { name: 'Abrir menu' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    const menu = screen.getByRole('navigation', { name: 'Navegação mobile' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(within(menu).getByRole('link', { name: 'Acessar painel' })).toHaveAttribute('href', '/painel')
    expect(within(menu).getByRole('link', { name: 'Criar minha loja' })).toHaveAttribute('href', '/painel?cadastro=1')
    await user.click(within(menu).getByRole('link', { name: 'Planos' }))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    await user.click(toggle)
    expect(screen.queryByRole('navigation', { name: 'Navegação mobile' })).not.toBeInTheDocument()
  })

  it('plays the v2 film in a dismissible native dialog with a vertical source for phones', async () => {
    const user = userEvent.setup()
    render(<LandingPage />)

    await user.click(screen.getByRole('button', { name: 'Assistir vídeo' }))
    let dialog = screen.getByRole('dialog', { name: 'Veja o TOPA em 30 segundos' })
    const video = dialog.querySelector('video')!
    expect(video).toHaveAttribute('controls')
    expect(video).toHaveAttribute('playsinline')
    expect(video.querySelector('source[media]')).toHaveAttribute('src', '/landing/topa-vertical-v2.mp4')
    expect(video.querySelector('source:not([media])')).toHaveAttribute(
      'src',
      '/landing/topa-horizontal-v2.mp4',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Fechar vídeo' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reproduzir demonstração' }))
    dialog = screen.getByRole('dialog')
    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reproduzir vídeo do TOPA' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fechar vídeo' }))
  })
})
