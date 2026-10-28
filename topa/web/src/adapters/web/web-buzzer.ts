import type { BuzzerPort } from '../../ports/buzzer'

// three long pulses, like the pager a restaurant hands out
const PAGER_PULSES = [400, 200, 400, 200, 400]

/** The Vibration API: Chrome on Android and the Android app's WebView (it needs the VIBRATE permission). */
export class WebBuzzer implements BuzzerPort {
  private readonly vibrate: (pattern: number[]) => boolean

  constructor(vibrate: (pattern: number[]) => boolean) {
    this.vibrate = vibrate
  }

  buzz(): void {
    this.vibrate(PAGER_PULSES)
  }
}
