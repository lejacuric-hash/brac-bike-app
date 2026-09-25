// "Search area" around a stop the team hasn't found yet: a 500–800 m circle
// whose centre is pushed off the stop in a random direction, so the stop is
// inside the circle but never in the middle. The randomness is seeded by
// session + stop, so the circle stays put every time the map is opened.

const METERS_PER_DEG_LAT = 111320

function seededRandom(seed) {
  // FNV-1a → [0, 1)
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) / 0x100000000
}

export function searchArea(seed, lat, lng) {
  const radiusM = 500 + seededRandom(`${seed}:radius`) * 300
  const offsetM = radiusM * (0.25 + 0.4 * seededRandom(`${seed}:offset`)) // stop stays well inside
  const bearing = seededRandom(`${seed}:bearing`) * 2 * Math.PI
  return {
    lat: lat + (offsetM * Math.cos(bearing)) / METERS_PER_DEG_LAT,
    lng: lng + (offsetM * Math.sin(bearing)) / (METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)),
    radiusM,
  }
}

// GeoJSON polygon approximating a circle (for a MapLibre fill layer)
export function circleFeature(lat, lng, radiusM, steps = 64) {
  const ring = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI
    ring.push([
      lng + (radiusM * Math.sin(a)) / (METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)),
      lat + (radiusM * Math.cos(a)) / METERS_PER_DEG_LAT,
    ])
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }
}
