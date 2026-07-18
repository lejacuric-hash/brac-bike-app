const EARTH_RADIUS_KM = 6371

export function toRadians(deg) {
  return (deg * Math.PI) / 180
}

export function toDegrees(rad) {
  return (rad * 180) / Math.PI
}

export function normalizeAngleDeg(deg) {
  return ((deg % 360) + 360) % 360
}

// Shortest signed difference a-b, wrapped to [-180, 180]
export function angleDiffDeg(a, b) {
  return normalizeAngleDeg(a - b + 180) - 180
}

export function haversineDistanceKm([lat1, lng1], [lat2, lng2]) {
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

// Initial bearing from a to b, 0=N, clockwise, 0-360
export function bearingDeg([lat1, lng1], [lat2, lng2]) {
  const phi1 = toRadians(lat1)
  const phi2 = toRadians(lat2)
  const dLng = toRadians(lng2 - lng1)
  const y = Math.sin(dLng) * Math.cos(phi2)
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng)
  return normalizeAngleDeg(toDegrees(Math.atan2(y, x)))
}

export function cumulativeDistancesKm(path) {
  const distances = [0]
  for (let i = 1; i < path.length; i += 1) {
    distances.push(distances[i - 1] + haversineDistanceKm(path[i - 1], path[i]))
  }
  return distances
}

export function totalPathDistanceKm(path) {
  if (!Array.isArray(path) || path.length < 2) return 0
  const distances = cumulativeDistancesKm(path)
  return distances[distances.length - 1]
}

// Projects point p onto segment [a,b] using a local planar approximation
// (equirectangular, scaled by latitude). Accurate to well under a meter at
// trail scale, and much simpler than true geodesic nearest-point-on-arc math.
export function nearestPointOnSegment(p, a, b) {
  const latRef = toRadians((a[0] + b[0]) / 2)
  const cosLat = Math.cos(latRef)

  const toXY = ([lat, lng]) => [(lng - a[1]) * cosLat, lat - a[0]]

  const [px, py] = toXY(p)
  const [bx, by] = toXY(b)

  const segLenSq = bx * bx + by * by
  let t = segLenSq === 0 ? 0 : (px * bx + py * by) / segLenSq
  t = Math.max(0, Math.min(1, t))

  const point = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
  const lateralDistanceKm = haversineDistanceKm(p, point)

  return { point, t, lateralDistanceKm }
}

// Scans all segments of path; returns the closest point overall.
export function nearestPointOnPath(path, p) {
  if (!Array.isArray(path) || path.length === 0) return null
  if (path.length === 1) {
    return {
      point: path[0],
      segmentIndex: 0,
      lateralDistanceKm: haversineDistanceKm(p, path[0]),
      distanceAlongKm: 0,
    }
  }

  const cumulative = cumulativeDistancesKm(path)
  let best = null

  for (let i = 0; i < path.length - 1; i += 1) {
    const { point, t, lateralDistanceKm } = nearestPointOnSegment(p, path[i], path[i + 1])
    if (!best || lateralDistanceKm < best.lateralDistanceKm) {
      const segDistanceKm = cumulative[i + 1] - cumulative[i]
      best = {
        point,
        segmentIndex: i,
        lateralDistanceKm,
        distanceAlongKm: cumulative[i] + t * segDistanceKm,
      }
    }
  }

  return best
}

// Interpolates the point at a given cumulative distance along path (clamped to ends)
export function pointAtDistanceAlongPath(path, targetKm) {
  if (!Array.isArray(path) || path.length === 0) return null
  if (path.length === 1) return path[0]

  const cumulative = cumulativeDistancesKm(path)
  const total = cumulative[cumulative.length - 1]

  if (targetKm <= 0) return path[0]
  if (targetKm >= total) return path[path.length - 1]

  for (let i = 0; i < path.length - 1; i += 1) {
    if (targetKm >= cumulative[i] && targetKm <= cumulative[i + 1]) {
      const segDistanceKm = cumulative[i + 1] - cumulative[i]
      const t = segDistanceKm === 0 ? 0 : (targetKm - cumulative[i]) / segDistanceKm
      return [
        path[i][0] + t * (path[i + 1][0] - path[i][0]),
        path[i][1] + t * (path[i + 1][1] - path[i][1]),
      ]
    }
  }

  return path[path.length - 1]
}

// Aim point for the guidance arrow: a bit ahead of the rider's projected
// position along the path.
export function findLookaheadTarget(path, distanceAlongKm, lookaheadMeters = 40) {
  return pointAtDistanceAlongPath(path, distanceAlongKm + lookaheadMeters / 1000)
}

// Finds hazards near the path and ahead of the rider's current progress.
export function findHazardsAheadOnPath(path, hazards, currentDistanceAlongKm, {
  corridorMeters = 40,
  lookaheadKm = 0.3,
} = {}) {
  if (!Array.isArray(path) || path.length < 2 || !Array.isArray(hazards) || hazards.length === 0) {
    return []
  }

  const corridorKm = corridorMeters / 1000
  const results = []

  for (const hazard of hazards) {
    if (hazard?.lat == null || hazard?.lng == null) continue
    const nearest = nearestPointOnPath(path, [hazard.lat, hazard.lng])
    if (!nearest) continue

    const aheadDistanceKm = nearest.distanceAlongKm - currentDistanceAlongKm
    if (nearest.lateralDistanceKm <= corridorKm && aheadDistanceKm >= 0 && aheadDistanceKm <= lookaheadKm) {
      results.push({
        ...hazard,
        distanceAlongKm: nearest.distanceAlongKm,
        lateralDistanceKm: nearest.lateralDistanceKm,
      })
    }
  }

  return results.sort((a, b) => a.distanceAlongKm - b.distanceAlongKm)
}
