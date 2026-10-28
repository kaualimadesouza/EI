import type { WakeLockPort } from '../../ports/wake-lock'

/** The Screen Wake Lock API: Chrome and the WebView on Android, Safari from iOS 16.4. */
export class WebWakeLock implements WakeLockPort {
  private readonly wakeLock: { request(type: 'screen'): Promise<Pick<WakeLockSentinel, 'release'>> }
  private readonly page: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>

  constructor(
    wakeLock: { request(type: 'screen'): Promise<Pick<WakeLockSentinel, 'release'>> },
    page: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'> = document,
  ) {
    this.wakeLock = wakeLock
    this.page = page
  }

  hold(): () => void {
    let held: Pick<WakeLockSentinel, 'release'> | null = null
    let holding = true
    // the browser lets go whenever the page is hidden, so take it again when the page is back;
    // a refusal (battery saver) leaves the usual timeout until the next try
    const request = () => {
      if (this.page.visibilityState !== 'visible') return
      this.wakeLock.request('screen').then(
        (granted) => {
          if (!holding) {
            void granted.release()
            return
          }
          void held?.release()
          held = granted
        },
        () => {},
      )
    }
    this.page.addEventListener('visibilitychange', request)
    request()
    return () => {
      holding = false
      this.page.removeEventListener('visibilitychange', request)
      void held?.release()
    }
  }
}
