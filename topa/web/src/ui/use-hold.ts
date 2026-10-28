import { useEffect, useRef } from 'react'

const HOLD_MS = 3000

/** Pointer handlers firing after a 3 s hold, for staff-only gestures customers never stumble on; none without a handler. */
export function useHold(onHold: (() => void) | undefined) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  if (!onHold) return undefined
  const release = () => clearTimeout(timer.current)
  return {
    onPointerDown: () => {
      timer.current = setTimeout(onHold, HOLD_MS)
    },
    onPointerUp: release,
    onPointerLeave: release,
    onPointerCancel: release,
  }
}
