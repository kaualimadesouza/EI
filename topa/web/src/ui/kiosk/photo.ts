export function photoOf(productId: string): string {
  return `${import.meta.env.BASE_URL}photos/${productId}.jpg`
}
