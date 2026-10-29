export function photoOf(productOrId: { id: string; photoUrl?: string } | string): string {
  if (typeof productOrId !== 'string' && productOrId.photoUrl && productOrId.photoUrl.trim() !== '') {
    return productOrId.photoUrl
  }
  const id = typeof productOrId === 'string' ? productOrId : productOrId.id
  return `${import.meta.env.BASE_URL}photos/${id}.jpg`
}
