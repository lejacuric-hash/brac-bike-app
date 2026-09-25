// Bike route alternatives from BRouter — the same routing service the
// Trails page planner uses. Asks for two variants of the touring profile plus
// the direct "fastbike" profile, drops near-duplicates and tags the shortest
// and the one with the least climbing.

const BROUTER_URL = 'https://brouter.de/brouter'
const FALLBACK_SPEED_KMH = 15 // same assumption as the Trails page planner

const REQUESTS = [
  { profile: 'trekking', alternative: 0 },
  { profile: 'trekking', alternative: 1 },
  { profile: 'fastbike', alternative: 0 },
]

async function fetchRoute(from, to, { profile, alternative }, signal) {
  const lonlats = `${from.lng},${from.lat}|${to.lng},${to.lat}`
  const url = `${BROUTER_URL}?lonlats=${encodeURIComponent(lonlats)}&profile=${profile}&alternativeidx=${alternative}&format=geojson`
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`BRouter ${response.status}`)
  const data = await response.json()
  const feature = Array.isArray(data?.features) ? data.features[0] : null
  const coords = feature?.geometry?.coordinates || []
  // Two points means BRouter drew a straight line — no real route
  if (coords.length < 3) return null
  const props = feature.properties || {}
  const distanceKm = Number(props['track-length']) / 1000
  const ascentM = Number(props['filtered ascend'] ?? props['plain-ascend'])
  const timeSec = Number(props['total-time'])
  return {
    id: `${profile}-${alternative}`,
    points: coords.map(([lng, lat]) => [lat, lng]),
    distanceKm,
    ascentM: Number.isFinite(ascentM) ? Math.max(0, ascentM) : null,
    durationSec: Number.isFinite(timeSec) && timeSec > 0 ? timeSec : (distanceKm / FALLBACK_SPEED_KMH) * 3600,
    tags: [],
  }
}

const isDuplicate = (a, b) =>
  Math.abs(a.distanceKm - b.distanceKm) / Math.max(a.distanceKm, 0.1) < 0.02 &&
  Math.abs((a.ascentM ?? 0) - (b.ascentM ?? 0)) < 10

export async function fetchRouteOptions(from, to, signal) {
  const settled = await Promise.allSettled(REQUESTS.map((r) => fetchRoute(from, to, r, signal)))
  const routes = []
  for (const result of settled) {
    const route = result.status === 'fulfilled' ? result.value : null
    if (route && Number.isFinite(route.distanceKm) && !routes.some((r) => isDuplicate(r, route))) {
      routes.push(route)
    }
  }
  if (!routes.length) {
    const firstError = settled.find((r) => r.status === 'rejected')
    throw firstError ? firstError.reason : new Error('No route found')
  }

  routes[0].tags.push('recommended')
  if (routes.length > 1) {
    const shortest = routes.reduce((a, b) => (b.distanceKm < a.distanceKm ? b : a))
    shortest.tags.push('shortest')
    const withAscent = routes.filter((r) => r.ascentM != null)
    if (withAscent.length > 1) {
      const flattest = withAscent.reduce((a, b) => (b.ascentM < a.ascentM ? b : a))
      flattest.tags.push('leastClimbing')
    }
  }
  return routes.slice(0, 3)
}

export function googleMapsUrl({ lat, lng }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}&travelmode=bicycling`
}
