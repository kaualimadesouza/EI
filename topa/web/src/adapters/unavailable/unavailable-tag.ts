import type { TagPort } from '../../ports/tag'

/** Browsers, desktop builds and Android devices without HCE: the totem leans on the printed sticker. */
export class UnavailableTag implements TagPort {
  readonly available = false

  publish(): void {}

  withdraw(): void {}
}
