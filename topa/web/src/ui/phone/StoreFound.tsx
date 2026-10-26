import type { StoreRef } from '../../domain/store'
import { PhoneScreen, PRIMARY_ACTION, SECONDARY_ACTION } from './PhoneScreen'

interface StoreFoundProps {
  store: StoreRef
  onScanAgain: () => void
}

/** Placeholder until the menu screens land: names the store and opens its web menu. */
export function StoreFound({ store, onScanAgain }: StoreFoundProps) {
  return (
    <PhoneScreen
      hero={
        <>
          <span className="flex h-14 w-fit items-center rounded-full bg-white px-5 text-lg font-semibold text-ink">
            {store.slug}
          </span>
          <h1 className="text-[clamp(2.75rem,13vw,4rem)] leading-[0.95] font-bold tracking-[-0.04em]">
            Loja encontrada.
          </h1>
        </>
      }
    >
      <a href={store.url} className={PRIMARY_ACTION}>
        Abrir cardápio
      </a>
      <button type="button" onClick={onScanAgain} className={SECONDARY_ACTION}>
        Ler outro adesivo
      </button>
    </PhoneScreen>
  )
}
