import { describe, expect, it } from 'vitest'

import { photoOf, PLACEHOLDER_PHOTO } from './photo'

describe('photoOf', () => {
  it('returns local photo path for string id of built-in products', () => {
    expect(photoOf('coxinha')).toBe('/photos/coxinha.jpg')
    expect(photoOf('cafe')).toBe('/photos/cafe.jpg')
  })

  it('returns custom photoUrl when present and non-empty', () => {
    expect(photoOf({ id: 'pastel', photoUrl: 'https://example.com/pastel.jpg' })).toBe(
      'https://example.com/pastel.jpg',
    )
  })

  it('falls back to local photo path when built-in product has empty photoUrl', () => {
    expect(photoOf({ id: 'coxinha' })).toBe('/photos/coxinha.jpg')
    expect(photoOf({ id: 'coxinha', photoUrl: '' })).toBe('/photos/coxinha.jpg')
    expect(photoOf({ id: 'coxinha', photoUrl: '   ' })).toBe('/photos/coxinha.jpg')
  })

  it('falls back to placeholder SVG when custom product has no photoUrl', () => {
    expect(photoOf('custom-item')).toBe(PLACEHOLDER_PHOTO)
    expect(photoOf({ id: 'custom-item' })).toBe(PLACEHOLDER_PHOTO)
    expect(photoOf({ id: 'custom-item', photoUrl: '' })).toBe(PLACEHOLDER_PHOTO)
    expect(photoOf({ id: 'custom-item', photoUrl: '   ' })).toBe(PLACEHOLDER_PHOTO)
  })
})
