import type { TagPort } from '../../ports/tag'

/** Browsers, desktop builds and Android without the bridge: the totem leans on the printed sticker. */
export class NoTag implements TagPort {
  readonly available = false

  publish(): void {}

  withdraw(): void {}
}
