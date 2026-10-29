import type { ReactNode } from 'react'

import { CloseIcon, DineInIcon, StoreMark, TakeAwayIcon } from '../icons'

// radius, weight and phone size every kiosk button shares; each call site keeps its tablet height and type
export const KIOSK_ACTION = 'rounded-control font-semibold phone:h-16 phone:text-label'
export const PRIMARY_ACTION = `${KIOSK_ACTION} bg-teal text-white`
export const SECONDARY_ACTION = `${KIOSK_ACTION} border-2 border-slate`

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
        className="flex max-h-full w-full max-w-[800px] flex-col gap-6 overflow-y-auto rounded-t-panel bg-white p-12 text-ink short:gap-4 short:p-8 max-sm:gap-4 max-sm:p-5 phone:gap-3"
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
    <div className="grid grid-cols-2 gap-4 max-sm:gap-3">
      <button
        type="button"
        onClick={onSecondary}
        className={`${SECONDARY_ACTION} h-[88px] px-3 text-label text-ink max-sm:h-20`}
      >
        {secondary}
      </button>
      <button
        type="button"
        onClick={onPrimary}
        className={`${PRIMARY_ACTION} h-[88px] px-3 text-label max-sm:h-20`}
      >
        {primary}
      </button>
    </div>
  )
}

interface HeaderProps {
  storeName: string | null
  dineIn: boolean
  cartEmpty: boolean
  locked: boolean
  onCancel: () => void
}

export function KioskHeader({ storeName, dineIn, cartEmpty, locked, onCancel }: HeaderProps) {
  return (
    <header className="flex h-[104px] flex-none items-center gap-4 border-b border-line bg-white px-12 short:h-20 max-sm:h-20 max-sm:gap-3 max-sm:px-4 phone:h-16 phone:gap-2 phone:pr-2">
      <span className="flex-none max-sm:hidden">
        <StoreMark size={48} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[22px] font-semibold max-sm:text-[17px] phone:text-body">{storeName ?? 'TOPA'}</span>
        <span className="flex items-center gap-2 text-[18px] text-muted max-sm:text-[14px]">
          {dineIn ? <DineInIcon size={20} /> : <TakeAwayIcon size={20} />}
          {dineIn ? 'Comer aqui' : 'Para viagem'}
        </span>
      </span>
      <button
        type="button"
        onClick={onCancel}
        disabled={locked}
        className="flex h-16 flex-none items-center gap-2 rounded-[16px] px-3 text-[22px] font-semibold text-slate disabled:opacity-40 max-sm:gap-1 max-sm:px-2 max-sm:text-[16px] phone:text-caption"
      >
        <CloseIcon size={28} className="phone:size-5" />
        {cartEmpty ? 'Voltar ao início' : 'Cancelar pedido'}
      </button>
    </header>
  )
}
