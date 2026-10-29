import { describe, expect, it } from 'vitest'

import { photoOf } from './photo'

describe('photoOf', () => {
  it('returns local photo path for string id', () => {
    expect(photoOf('coxinha')).toBe('/photos/coxinha.jpg')
  })

  it('returns custom photoUrl when present and non-empty', () => {
    expect(photoOf({ id: 'pastel', photoUrl: 'https://example.com/pastel.jpg' })).toBe(
      'https://example.com/pastel.jpg',
    )
  })

  it('falls back to local photo path when photoUrl is undefined or empty', () => {
    expect(photoOf({ id: 'pastel' })).toBe('/photos/pastel.jpg')
    expect(photoOf({ id: 'pastel', photoUrl: '' })).toBe('/photos/pastel.jpg')
    expect(photoOf({ id: 'pastel', photoUrl: '   ' })).toBe('/photos/pastel.jpg')
  })
})
