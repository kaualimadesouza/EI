import type { BuzzerPort } from '../../ports/buzzer'

/** No Vibration API (iPhones, desktops): the blinking icon on the screen calls the customer alone. */
export class UnavailableBuzzer implements BuzzerPort {
  buzz(): void {}
}
