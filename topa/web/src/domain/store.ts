/** A store the phone app can open, read from the NFC sticker next to its totem. */
export interface StoreRef {
  slug: string
  url: string
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
