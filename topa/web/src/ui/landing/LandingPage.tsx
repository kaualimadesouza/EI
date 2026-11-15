import { useState } from 'react'

import { formatBRL } from '../../domain/menu'
import {
  BellIcon,
  CategoryIcon,
  CheckIcon,
  ClockIcon,
  ContactlessIcon,
  DineInIcon,
  StoreMark,
} from '../icons'
import { LANDING_NAV, PLANS, PRODUCT_STEPS, QUESTIONS } from './content'
import { VideoDialog } from './VideoDialog'
import styles from './LandingPage.module.css'

const BASE = import.meta.env.BASE_URL
const image = (name: string) => `${BASE}landing/${name}`

function Arrow() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </svg>
  )
}

function Play() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="m7 4 9 6-9 6z" />
    </svg>
  )
}

function Brand() {
  return (
    <a className={styles.brand} href="#inicio" aria-label="TOPA, início">
      <img src={`${BASE}topa-mark.png`} alt="" width="22" height="36" />
      <span>
        TOPA<span className={styles.brandDot}>.</span>
      </span>
    </a>
  )
}

function HeroArt() {
  return (
    <div className={styles.heroArt} aria-hidden="true">
      <div className={styles.heroOrbit} />
      <div className={styles.orbitLabel}>
        <span /> Do primeiro toque ao balcão.
      </div>
      <svg className={styles.heroLine} viewBox="0 0 620 650" fill="none">
        <path
          d="M10 380h90c45 0 35-195 95-195h280c50 0 50 340 95 340h40"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeDasharray="5 7"
        />
      </svg>
      <div className={styles.heroDevice}>
        <span className={styles.deviceCamera} />
        <img src={image('kiosk.webp')} alt="" width="1050" height="1400" fetchPriority="high" />
        <span className={styles.deviceFoot} />
      </div>
      <div className={styles.heroOrder}>
        <div className={styles.orderTop}>
          <span className={styles.orderIcon}>
            <CheckIcon size={18} />
          </span>
          <span>
            Pedido recebido<small>Exemplo de pedido</small>
          </span>
          <span className={styles.orderTime}>agora</span>
        </div>
        <div className={styles.orderBottom}>
          <img src={`${BASE}photos/xsalada.jpg`} alt="" width="48" height="48" />
          <span>
            <strong>001</strong>
            <span>Vai sair um X-salada.</span>
          </span>
          <Arrow />
        </div>
      </div>
      <div className={styles.heroPhone}>
        <img src={image('phone.webp')} alt="" width="780" height="1560" />
        <span>
          <ContactlessIcon size={18} /> Também no celular
        </span>
      </div>
      <div className={styles.artCaption}>
        <span className={styles.captionLine} /> Uma experiência. Mais jeitos de pedir.
      </div>
    </div>
  )
}

interface LandingPageProps {
  contactUrl?: string
}

export function LandingPage({ contactUrl = import.meta.env.VITE_COMMERCIAL_CONTACT_URL }: LandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const step = PRODUCT_STEPS[stepIndex]
  const proposalHref = contactUrl || `${BASE}painel?cadastro=1`
  const proposalLabel = contactUrl ? 'Solicitar proposta' : 'Criar minha loja'

  return (
    <div className={styles.page} id="inicio">
      <a className={styles.skipLink} href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className={styles.header}>
        <div className={styles.navShell}>
          <Brand />
          <nav className={styles.desktopNav} aria-label="Navegação principal">
            {LANDING_NAV.map((entry) => (
              <a key={entry.href} href={entry.href}>
                {entry.label}
              </a>
            ))}
          </nav>
          <div className={styles.navActions}>
            <a className={styles.merchantLink} href={`${BASE}painel`}>
              Acessar painel
            </a>
            <a className={styles.navCta} href={`${BASE}pedir`}>
              Abrir cardápio <Arrow />
            </a>
          </div>
          <button
            className={styles.menuToggle}
            type="button"
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-nav"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
        <nav
          id="landing-mobile-nav"
          className={styles.mobileNav}
          hidden={!menuOpen}
          aria-label="Navegação mobile"
        >
          {LANDING_NAV.map((entry) => (
            <a key={entry.href} href={entry.href} onClick={() => setMenuOpen(false)}>
              {entry.label}
              <Arrow />
            </a>
          ))}
          <a href={`${BASE}painel`}>Acessar painel <Arrow /></a>
          <a href={`${BASE}painel?cadastro=1`}>Criar minha loja <Arrow /></a>
        </nav>
      </header>

      <main id="conteudo">
        <section className={`${styles.wrap} ${styles.hero}`} aria-labelledby="landing-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              <span className={styles.smallDot} /> Totem por assinatura
            </p>
            <h1 id="landing-title">
              Seu próximo pedido começa <span>com um toque.</span>
            </h1>
            <p className={styles.heroLead}>
              Autoatendimento no seu balcão ou no celular do cliente. Você acompanha os pedidos. Sua equipe
              cuida do que faz de melhor.
            </p>
            <div className={styles.heroActions}>
              <a href="#planos" className={styles.primaryButton}>
                Ver planos <Arrow />
              </a>
              <button className={styles.videoButton} type="button" onClick={() => setVideoOpen(true)}>
                <span>
                  <Play />
                </span>{' '}
                Assistir vídeo
              </button>
            </div>
            <p className={styles.heroNote}>
              <CheckIcon size={17} /> Equipamento, software e suporte em uma assinatura.
            </p>
          </div>
          <HeroArt />
        </section>

        <div className={`${styles.wrap} ${styles.audience}`}>
          <p>
            Feito para quem
            <br />
            <strong>movimenta o bairro.</strong>
          </p>
          <span>
            <CategoryIcon category="lanches" size={28} /> Lanchonetes
          </span>
          <span>
            <CategoryIcon category="bebidas" size={28} /> Cafeterias
          </span>
          <span>
            <DineInIcon size={28} /> Restaurantes
          </span>
          <span>
            <StoreMark size={28} /> Comércios de bairro
          </span>
        </div>

        <section
          className={`${styles.section} ${styles.productSection}`}
          id="como-funciona"
          aria-labelledby="flow-title"
        >
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>Um fluxo, do começo ao fim</p>
              <h2 id="flow-title">
                O pedido flui.
                <br />O balcão <span>respira.</span>
              </h2>
              <p>Três pontos de contato. Uma experiência pensada para o dia a dia da sua loja.</p>
            </div>
            <div className={styles.productLayout}>
              <div className={styles.productCopy}>
                <div className={styles.stepControls} role="group" aria-label="Explore o TOPA">
                  {PRODUCT_STEPS.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={stepIndex === index}
                      onClick={() => setStepIndex(index)}
                    >
                      <span aria-hidden="true">{item.number}</span>
                      {item.label}
                      <Arrow />
                    </button>
                  ))}
                </div>
                <div className={styles.stepCopy} aria-live="polite">
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  <span className={styles.stepDetail}>
                    <CheckIcon size={18} /> {step.detail}
                  </span>
                </div>
              </div>
              <div className={`${styles.productPreview} ${styles[step.id]}`}>
                <div className={styles.previewLabel}>
                  <span /> O TOPA na prática
                </div>
                <img
                  key={step.id}
                  src={image(step.image)}
                  alt={step.alt}
                  width={step.id === 'dashboard' ? 1500 : 780}
                  height={step.id === 'dashboard' ? 608 : 1200}
                  loading="lazy"
                />
                <p>Demonstração do produto</p>
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.benefits}`} aria-label="O que muda no seu balcão">
          <article>
            <span className={styles.benefitIcon}>
              <ClockIcon size={28} />
            </span>
            <h3>O pico ganha outro caminho.</h3>
            <p>Com o totem ocupado, o cliente abre o cardápio pelo celular e faz um novo pedido.</p>
          </article>
          <article>
            <span className={styles.benefitIcon}>
              <CategoryIcon category="combos" size={28} />
            </span>
            <h3>O cardápio também sugere.</h3>
            <p>Um suco com o lanche, um café com o doce. Sugestões para completar o pedido.</p>
          </article>
          <article>
            <span className={styles.benefitIcon}>
              <BellIcon size={28} />
            </span>
            <h3>Cada pedido no seu lugar.</h3>
            <p>Recebido, em preparo ou pronto. A operação fica visível para quem está no balcão.</p>
          </article>
        </section>

        <section
          className={`${styles.wrap} ${styles.filmSection}`}
          id="demonstracao"
          aria-labelledby="demo-title"
        >
          <div className={styles.filmCopy}>
            <p className={styles.eyebrow}>Antes de imaginar, veja.</p>
            <h2 id="demo-title">
              Seu balcão.
              <br />
              Em outro ritmo.
            </h2>
            <p>Do primeiro toque ao pedido no painel. Conheça o TOPA em 30 segundos.</p>
            <button type="button" className={styles.textButton} onClick={() => setVideoOpen(true)}>
              Reproduzir demonstração <Arrow />
            </button>
            <span className={styles.filmDuration}>00:30 · Som ligado fica ainda melhor</span>
          </div>
          <button
            type="button"
            className={styles.filmPoster}
            aria-label="Reproduzir vídeo do TOPA"
            onClick={() => setVideoOpen(true)}
          >
            <img src={image('video-poster.webp')} alt="" width="1400" height="788" loading="lazy" />
            <span className={styles.playLarge}>
              <Play />
            </span>
            <span className={styles.posterCaption}>
              Da fila ao fluxo.{' '}
              <span>
                Conheça o TOPA <Arrow />
              </span>
            </span>
          </button>
        </section>

        <section
          className={`${styles.section} ${styles.planSection}`}
          id="planos"
          aria-labelledby="plans-title"
        >
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>Cada balcão tem seu momento</p>
              <h2 id="plans-title">
                Um plano para
                <br />
                <span>o seu momento.</span>
              </h2>
              <p>Comece com o que sua loja precisa. Planeje os próximos passos com TOPA.</p>
            </div>
            <div className={styles.plans}>
              {PLANS.map((plan) => (
                <article
                  key={plan.id}
                  className={`${styles.plan} ${plan.featured ? styles.featuredPlan : ''}`}
                >
                  {plan.featured && <p className={styles.planBadge}>O formato completo para o balcão</p>}
                  <p className={styles.planCategory}>{plan.category}</p>
                  <h3>{plan.name}</h3>
                  <p className={styles.planDescription}>{plan.description}</p>
                  <div className={styles.planPrice}>
                    <span>{plan.priceCents === null ? 'Sob consulta' : formatBRL(plan.priceCents)}</span>
                    <small>{plan.priceNote}</small>
                  </div>
                  <a
                    className={plan.featured ? styles.primaryButton : styles.outlineButton}
                    href={proposalHref}
                    aria-label={`${proposalLabel}: ${plan.name}`}
                  >
                    {proposalLabel}
                    <Arrow />
                  </a>
                  <div className={styles.planRule} />
                  <p className={styles.includes}>O que está na proposta</p>
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <CheckIcon size={18} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <p className={styles.pricingNote}>
              Valores propostos para o piloto. A proposta confirma os equipamentos, a implantação e as
              condições de cada loja. Taxas de pagamento são tratadas separadamente.
            </p>
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.faqSection}`} id="perguntas" aria-labelledby="faq-title">
          <div>
            <p className={styles.eyebrow}>Vamos deixar tudo claro</p>
            <h2 id="faq-title">
              Pode perguntar.
              <br />
              <span>A gente explica.</span>
            </h2>
            <p>O básico para você entender como o TOPA pode entrar na sua operação.</p>
          </div>
          <div className={styles.faq}>
            {QUESTIONS.map((item) => (
              <details key={item.question} name="topa-faq">
                <summary>
                  {item.question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.closing}`} aria-labelledby="closing-title">
          <div className={styles.closingInner}>
            <div>
              <p className={styles.eyebrow}>O próximo passo cabe em um toque.</p>
              <h2 id="closing-title">
                Topa dar outro ritmo
                <br />
                ao seu balcão?
              </h2>
              <p>Comece conhecendo a experiência que seu cliente vai encontrar.</p>
            </div>
            <a className={styles.lightButton} href={contactUrl || `${BASE}pedir`}>
              {contactUrl ? 'Solicitar proposta' : 'Explorar cardápio'}
              <Arrow />
            </a>
            <svg className={styles.closingArt} viewBox="0 0 300 300" fill="none" aria-hidden="true">
              <circle cx="150" cy="150" r="95" />
              <circle cx="150" cy="150" r="125" />
              <circle cx="150" cy="150" r="155" />
            </svg>
          </div>
        </section>
      </main>

      <footer className={`${styles.wrap} ${styles.footer}`}>
        <div>
          <Brand />
          <p>
            Autoatendimento para quem
            <br />
            cuida do comércio de perto.
          </p>
        </div>
        <nav aria-label="Links do rodapé">
          <a href="#como-funciona">Como funciona</a>
          <a href="#planos">Nossos planos</a>
          <a href="#perguntas">Perguntas frequentes</a>
        </nav>
        <div className={styles.footerNote}>
          <p>Feito para o seu balcão.</p>
          <small>Projeto acadêmico · EACH/USP · Grupo T94</small>
        </div>
      </footer>
      {videoOpen && <VideoDialog onClose={() => setVideoOpen(false)} />}
    </div>
  )
}
