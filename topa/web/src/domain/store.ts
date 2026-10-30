import type { Product } from './menu'

/** A store loaded from the catalog, with the display name shown on its screens. */
export interface Store {
  slug: string
  name: string
  cnpj?: string
}

/** One store and its whole menu in display order, sold-out products included. */
export interface StoreMenu {
  store: Store
  products: Product[]
}

/** A store the phone app can open, read from its totem's NFC tag (the totem itself or its sticker). */
export interface StoreRef {
  slug: string
  url: string
}

/** The store this page was opened for: none, a well-formed slug, or a `loja` that can never exist. */
export type LocationStore = { kind: 'absent' } | { kind: 'valid'; slug: string } | { kind: 'invalid' }

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// the API refuses longer slugs with 422, so a longer one is never a store
const SLUG_MAX_LENGTH = 64
const PUBLIC_ORIGIN = 'https://topa-totem.vercel.app'
export const DEMO_STORE_SLUG = 'lanchonete-bem-te-vi'
export const DEMO_STORE_NAME = 'Lanchonete Bem-te-vi'

function isStoreSlug(slug: string): boolean {
  return slug.length <= SLUG_MAX_LENGTH && SLUG.test(slug)
}

/** The tag holds the store's web URL; anything without a valid `loja` slug is not ours. */
export function storeFromUrl(text: string): StoreRef | null {
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const slug = url.searchParams.get('loja')
  if (slug === null || !isStoreSlug(slug)) return null
  return { slug, url: url.href }
}

/** A typo in `loja` must not fall back to the demo store, so it is kept apart from no `loja` at all. */
export function locationStore(href: string): LocationStore {
  const slug = new URL(href).searchParams.get('loja')
  if (slug === null) return { kind: 'absent' }
  return isStoreSlug(slug) ? { kind: 'valid', slug } : { kind: 'invalid' }
}

function isReachableFromPhone(url: URL): boolean {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  const host = url.hostname.replace(/\.$/, '')
  return (
    host !== 'localhost' &&
    !host.endsWith('.localhost') &&
    !host.startsWith('127.') &&
    host !== '0.0.0.0' &&
    host !== '[::1]' &&
    host !== '[::]'
  )
}

/** A phone scanning the queue QR cannot reach the totem's own loopback, so local runs point to the hosted site. */
export function phoneMenuUrl(origin: string, basePath = '/', storeSlug = DEMO_STORE_SLUG): string {
  let url: URL
  try {
    const candidate = new URL(basePath, origin)
    url = isReachableFromPhone(candidate) ? candidate : new URL(PUBLIC_ORIGIN)
  } catch {
    url = new URL(PUBLIC_ORIGIN)
  }
  url.searchParams.set('loja', storeSlug)
  return url.href
}
