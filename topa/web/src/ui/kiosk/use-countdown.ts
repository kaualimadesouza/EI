import { useEffect, useRef, useState } from 'react'

/** Seconds left on a timer that restarts whenever `resetKey` changes; calls onDone once at zero. */
export function useCountdown(seconds: number, onDone: () => void, resetKey: unknown = null): number {
  const [left, setLeft] = useState(seconds)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    setLeft(seconds)
    const started = Date.now()
    const timer = setInterval(() => {
      const remaining = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000))
      setLeft(remaining)
      if (remaining === 0) {
        clearInterval(timer)
        done.current()
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [seconds, resetKey])

  return left
}
