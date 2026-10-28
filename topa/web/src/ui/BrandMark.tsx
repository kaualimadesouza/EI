import { useRef } from 'react'

const STAFF_TAPS = 5
const STAFF_WINDOW_MS = 2000

interface BrandMarkProps {
  label: string
  className: string
  /** Five quick taps on the mark: the hidden staff gesture that flips the device between phone and totem. */
  onStaffTaps?: () => void
}

/** The TOPA mark with the app version, so staff can tell which build a device runs. */
export function BrandMark({ label, className, onStaffTaps }: BrandMarkProps) {
  const taps = useRef<number[]>([])

  // taps, not a long press: the Android WebView may cancel a held pointer for its own gestures
  function tap(fire: () => void) {
    const now = Date.now()
    taps.current = [...taps.current.filter((at) => now - at < STAFF_WINDOW_MS), now]
    if (taps.current.length < STAFF_TAPS) return
    taps.current = []
    fire()
  }

  return (
    <p onClick={onStaffTaps && (() => tap(onStaffTaps))} className={`flex items-center gap-2 select-none ${className}`}>
      <img src={`${import.meta.env.BASE_URL}topa-mark.png`} alt="" draggable={false} className="h-6 w-auto brightness-0 invert" />
      {label}
      <span className="text-sm font-medium tabular-nums">v{__APP_VERSION__}</span>
    </p>
  )
}
