export const BUILT_IN_PHOTOS = new Set([
  'agua',
  'americano',
  'bauru',
  'bolo',
  'brigadeiro',
  'brownie',
  'cafe',
  'combo-cafe',
  'combo-misto',
  'coxinha',
  'enroladinho',
  'esfiha',
  'misto',
  'paoqueijo',
  'pudim',
  'refri',
  'suco',
  'xsalada',
])

export const PLACEHOLDER_PHOTO =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="160" height="120"%3E%3Crect width="160" height="120" fill="%23f3f0e6" rx="8"/%3E%3Cpath d="M70 45v30m10-30v30m10-30v30M65 45h30" stroke="%23b8a898" stroke-width="3" stroke-linecap="round"/%3E%3C/svg%3E'

export function photoOf(productOrId: { id: string; photoUrl?: string } | string): string {
  if (typeof productOrId !== 'string' && productOrId.photoUrl && productOrId.photoUrl.trim() !== '') {
    return productOrId.photoUrl
  }
  const id = typeof productOrId === 'string' ? productOrId : productOrId.id
  if (BUILT_IN_PHOTOS.has(id)) {
    return `${import.meta.env.BASE_URL}photos/${id}.jpg`
  }
  return PLACEHOLDER_PHOTO
}
