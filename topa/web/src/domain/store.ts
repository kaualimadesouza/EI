/** A store the phone app can open, read from the NFC sticker next to its totem. */
export interface StoreRef {
  slug: string
  url: string
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PUBLIC_ORIGIN = 'https://topa-totem.vercel.app'
const DEMO_STORE_SLUG = 'lanchonete-bem-te-vi'

/** The sticker holds the store's web URL; anything without a valid `loja` slug is not ours. */
export function storeFromUrl(text: string): StoreRef | null {
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const slug = url.searchParams.get('loja')
  if (slug === null || !SLUG.test(slug)) return null
  return { slug, url: url.href }
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

/** A phone scanning the queue QR cannot reach the totem's own loopback, so local runs point to the hosted demo. */
export function phoneMenuUrl(origin: string, basePath = '/'): string {
  let url: URL
  try {
    const candidate = new URL(basePath, origin)
    url = isReachableFromPhone(candidate) ? candidate : new URL(PUBLIC_ORIGIN)
  } catch {
    url = new URL(PUBLIC_ORIGIN)
  }
  url.searchParams.set('loja', DEMO_STORE_SLUG)
  return url.href
}
