import type { WakeLockPort } from '../../ports/wake-lock'

/** No Screen Wake Lock API: the screen keeps its usual timeout. */
export class UnavailableWakeLock implements WakeLockPort {
  hold(): () => void {
    return () => {}
  }
}
