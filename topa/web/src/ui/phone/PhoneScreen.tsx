import type { ReactNode } from 'react'

import { useHold } from '../use-hold'

export const PRIMARY_ACTION =
  'flex min-h-16 w-full items-center justify-center rounded-full bg-teal px-6 text-xl font-semibold text-white focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-teal active:scale-[0.98]'

export const SECONDARY_ACTION =
  'flex min-h-16 w-full items-center justify-center rounded-full border-2 border-slate px-6 text-xl font-semibold text-slate focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-teal active:scale-[0.98]'

interface PhoneScreenProps {
  hero: ReactNode
  children: ReactNode
  /** Staff hold the TOPA mark for 3 s to turn this device into the store's totem. */
  onHoldMark?: () => void
}

/** The phone app's frame: brand on top, the message on teal, the actions on a cream sheet. */
export function PhoneScreen({ hero, children, onHoldMark }: PhoneScreenProps) {
  const hold = useHold(onHoldMark)
  return (
    <section className="flex flex-1 flex-col bg-teal text-white">
      <p {...hold} className="flex items-center gap-2 px-6 pt-12 text-base font-semibold text-on-teal select-none">
        <img src="/topa-mark.png" alt="" className="h-7 w-auto brightness-0 invert" />
        TOPA
        <span className="ml-auto text-sm font-medium tabular-nums">v{__APP_VERSION__}</span>
      </p>
      <div className="flex flex-1 flex-col justify-end gap-5 px-6 pt-10 pb-10">{hero}</div>
      <div className="flex flex-col gap-4 rounded-t-[2rem] bg-cream px-6 pt-8 pb-12 text-ink">{children}</div>
    </section>
  )
}
