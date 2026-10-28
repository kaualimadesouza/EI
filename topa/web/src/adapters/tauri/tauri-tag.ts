import type { TagPort } from '../../ports/tag'

/** What MainActivity puts on window as `TopaTag`; TagEmulationService serves the published URL. */
export interface TagBridge {
  publish(url: string): void
  withdraw(): void
}

declare global {
  interface Window {
    TopaTag?: TagBridge
  }
}

/** The Android totem answering phones as an NFC tag itself, through the app's Kotlin bridge. */
export class TauriTag implements TagPort {
  readonly available = true
  private readonly bridge: TagBridge

  constructor(bridge: TagBridge) {
    this.bridge = bridge
  }

  // a Java bridge method only runs when called on the injected object itself
  publish(url: string): void {
    this.bridge.publish(url)
  }

  withdraw(): void {
    this.bridge.withdraw()
  }
}
