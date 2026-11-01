import { describe, expect, it } from 'vitest'

import {
  calculateDistanceMeters,
  EACH_USP_COORDINATES,
  formatDistance,
  formatWalkingTime,
} from './geo'

describe('geo', () => {
  it('calculates distance between two coordinates correctly', () => {
    const pointA = { latitude: -23.4822, longitude: -46.5009 }
    const pointB = { latitude: -23.4835, longitude: -46.4998 }
    const distance = calculateDistanceMeters(pointA, pointB)
    expect(distance).toBeGreaterThan(150)
    expect(distance).toBeLessThan(250)

    // Distance to itself is zero
    expect(calculateDistanceMeters(pointA, pointA)).toBe(0)
  })

  it('formats distance in meters and kilometers in Portuguese', () => {
    expect(formatDistance(50)).toBe('50 m')
    expect(formatDistance(850)).toBe('850 m')
    expect(formatDistance(1200)).toBe('1,2 km')
    expect(formatDistance(3500)).toBe('3,5 km')
  })

  it('formats walking time accurately', () => {
    expect(formatWalkingTime(40)).toBe('1 min a pé')
    expect(formatWalkingTime(160)).toBe('2 min a pé')
    expect(formatWalkingTime(800)).toBe('10 min a pé')
  })

  it('provides campus default coordinates', () => {
    expect(EACH_USP_COORDINATES.latitude).toBeCloseTo(-23.4822)
    expect(EACH_USP_COORDINATES.longitude).toBeCloseTo(-46.5009)
  })
})
