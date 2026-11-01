export interface Coordinates {
  latitude: number
  longitude: number
}

export const EACH_USP_COORDINATES: Coordinates = {
  latitude: -23.4822,
  longitude: -46.5009,
}

const EARTH_RADIUS_METERS = 6371000
const AVERAGE_WALKING_METERS_PER_MINUTE = 80

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Calculates great-circle distance between two geographic coordinates in meters. */
export function calculateDistanceMeters(
  coord1: Coordinates,
  coord2: Coordinates,
): number {
  const dLat = toRadians(coord2.latitude - coord1.latitude)
  const dLon = toRadians(coord2.longitude - coord1.longitude)
  const lat1 = toRadians(coord1.latitude)
  const lat2 = toRadians(coord2.latitude)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(EARTH_RADIUS_METERS * c)
}

/** Formats a distance in meters into friendly Brazilian Portuguese display text. */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`
  }
  const km = (meters / 1000).toFixed(1).replace('.', ',')
  return `${km} km`
}

/** Estimates walking time in minutes based on distance in meters. */
export function formatWalkingTime(meters: number): string {
  const minutes = Math.max(1, Math.round(meters / AVERAGE_WALKING_METERS_PER_MINUTE))
  return `${minutes} min a pé`
}
