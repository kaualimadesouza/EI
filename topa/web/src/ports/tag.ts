/** Makes this device answer phones as an NFC tag holding one URL, so the totem needs no sticker. */
export interface TagPort {
  /** False where the device cannot be a tag; the kiosk then points the customer to the sticker. */
  readonly available: boolean
  publish(url: string): void
  withdraw(): void
}
