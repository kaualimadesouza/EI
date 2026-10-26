import type { ReactNode } from 'react'

import { CloseIcon, DineInIcon, StoreMark, TakeAwayIcon } from './icons'

interface SheetProps {
  title: string
  children: ReactNode
}

/** Bottom sheet over a dimmed screen: the kiosk's only modal, kept within arm's reach. */
export function Sheet({ title, children }: SheetProps) {
  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-ink/55">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex w-full max-w-[800px] flex-col gap-6 rounded-t-[32px] bg-white p-12 text-ink"
      >
        {children}
      </section>
    </div>
  )
}

interface ChoiceButtonsProps {
  secondary: string
  primary: string
  onSecondary: () => void
  onPrimary: () => void
}

export function ChoiceButtons({ secondary, primary, onSecondary, onPrimary }: ChoiceButtonsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <button
        type="button"
        onClick={onSecondary}
        className="h-[88px] rounded-[24px] border-2 border-slate text-[22px] font-semibold text-ink"
      >
        {secondary}
      </button>
      <button
        type="button"
        onClick={onPrimary}
        className="h-[88px] rounded-[24px] bg-teal text-[22px] font-semibold text-white"
      >
        {primary}
      </button>
    </div>
  )
}

interface HeaderProps {
  dineIn: boolean
  cartEmpty: boolean
  locked: boolean
  onCancel: () => void
}

export function KioskHeader({ dineIn, cartEmpty, locked, onCancel }: HeaderProps) {
  return (
    <header className="flex h-[104px] flex-none items-center gap-4 border-b border-line bg-white px-12">
      <StoreMark size={48} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[22px] font-semibold">Lanchonete Bem-te-vi</span>
        <span className="flex items-center gap-2 text-[18px] text-muted">
          {dineIn ? <DineInIcon size={20} /> : <TakeAwayIcon size={20} />}
          {dineIn ? 'Comer aqui' : 'Para viagem'}
        </span>
      </span>
      <button
        type="button"
        onClick={onCancel}
        disabled={locked}
        className="flex h-16 items-center gap-2 rounded-[16px] px-3 text-[22px] font-semibold text-slate disabled:opacity-40"
      >
        <CloseIcon size={28} />
        {cartEmpty ? 'Voltar ao início' : 'Cancelar pedido'}
      </button>
    </header>
  )
}
