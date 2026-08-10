const CACHE_NAME = 'brac-bike-map-v1'
const TILE_CACHE_NAME = 'brac-bike-tiles-v1'

// Cache app shell on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/tracks/tracks.json',
      ])
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== TILE_CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// Intercept fetch requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  const isOsmTile = url.hostname.includes('tile.openstreetmap.org')
  const isMapTilerTile = url.hostname.includes('api.maptiler.com')

  // OSM tiles: cache-first — used as the offline fallback base map (see
  // TrailsPage's OSM_RASTER_STYLE), populated opportunistically as the rider
  // browses. Once a tile is cached it's never re-fetched from the network.
  if (isOsmTile) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request)
        if (cached) return cached

        try {
          const response = await fetch(event.request)
          if (response.ok) cache.put(event.request, response.clone())
          return response
        } catch {
          return new Response('', { status: 503 })
        }
      })
    )
    return
  }

  // MapTiler tiles: cached opportunistically as the user browses online.
  // There is deliberately no bulk pre-download for these (or for OSM tiles
  // above) — MapTiler's style is 5 vector sources plus sprites/glyphs with no
  // single flat tile URL, and OpenStreetMap's tile usage policy explicitly
  // discourages bulk/systematic downloading against tile.openstreetmap.org.
  // Both layers rely entirely on this opportunistic caching as the rider
  // actually browses the map.
  if (isMapTilerTile) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request)
        if (cached) return cached

        try {
          const response = await fetch(event.request)
          if (response.ok) cache.put(event.request, response.clone())
          return response
        } catch {
          return new Response('', { status: 503 })
        }
      })
    )
    return
  }

  // For everything else, network first, fall back to cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})
