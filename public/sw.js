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

  // Cache MapTiler tile requests
  const isMapTile =
    url.hostname.includes('maptiler') ||
    url.hostname.includes('opentopomap') ||
    url.hostname.includes('thunderforest')

  if (isMapTile) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request)
        if (cached) return cached

        try {
          const response = await fetch(event.request)
          if (response.ok) {
            cache.put(event.request, response.clone())
          }
          return response
        } catch {
          // Offline and not cached - return empty response
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

// ---- Manual "Download Map" pre-fetch ----
//
// The live map uses a MapLibre *vector* style, not a flat {z}/{x}/{y} tile
// endpoint. That style has five independent tile sources (basemap polygons,
// contours, landform, terrain-rgb) plus sprites and font glyphs, each with
// its own URL template and its own zoom range. To make the map actually
// usable offline afterward, this has to pre-fetch each of those exact
// request URLs — anything else (e.g. a flat raster tile endpoint) would get
// cached under URLs the live vector map never requests, and would sit in
// the cache unused.

const DEFAULT_BRAC_BOUNDS = {
  minLng: 16.20,
  maxLng: 17.05,
  minLat: 43.20,
  maxLat: 43.42,
}
const DEFAULT_ZOOM_LEVELS = [8, 9, 10, 11, 12, 13, 14]
const TILE_FETCH_CONCURRENCY = 8
const PROGRESS_REPORT_EVERY = 15

function lng2tile(lng, zoom) {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom))
}

function lat2tile(lat, zoom) {
  return Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  )
}

// A style's source is either an inline TileJSON-like object (has its own
// `tiles` array directly) or a reference to a remote TileJSON manifest (has
// a `url` pointing at one) — MapTiler style sources use the latter. Resolve
// either shape down to the same { template, minzoom, maxzoom } result.
async function resolveSourceTileset(sourceDef) {
  if (Array.isArray(sourceDef.tiles) && sourceDef.tiles.length > 0) {
    return {
      template: sourceDef.tiles[0],
      minzoom: sourceDef.minzoom ?? 0,
      maxzoom: sourceDef.maxzoom ?? 22,
    }
  }

  if (sourceDef.url) {
    const response = await fetch(sourceDef.url)
    if (!response.ok) return null
    const tilejson = await response.json()
    if (Array.isArray(tilejson.tiles) && tilejson.tiles.length > 0) {
      return {
        template: tilejson.tiles[0],
        minzoom: tilejson.minzoom ?? sourceDef.minzoom ?? 0,
        maxzoom: tilejson.maxzoom ?? sourceDef.maxzoom ?? 22,
      }
    }
  }

  return null
}

function buildTileUrl(template, z, x, y) {
  return template.replace('{z}', z).replace('{x}', x).replace('{y}', y)
}

// Collects every distinct font stack any layer's text-font references, so
// glyph PBFs for the fonts actually used can be pre-cached too — otherwise
// labels silently fail to render offline even though the tiles are cached.
function collectFontStacks(styleLayers) {
  const stacks = new Set()
  for (const layer of styleLayers || []) {
    const fontStack = layer?.layout?.['text-font']
    if (Array.isArray(fontStack) && fontStack.length > 0) {
      stacks.add(fontStack.join(','))
    }
  }
  return Array.from(stacks)
}

async function cacheUrl(cache, url) {
  try {
    const response = await fetch(url)
    if (response.ok) {
      await cache.put(url, response.clone())
      return true
    }
    return false
  } catch {
    return false
  }
}

// Simple bounded-concurrency queue — thousands of sequential tile fetches
// would be extremely slow, but firing them all at once risks overwhelming
// the connection pool / tripping rate limits.
async function runWithConcurrency(items, limit, worker) {
  let cursor = 0
  const runners = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      await worker(items[index], index)
    }
  })
  await Promise.all(runners)
}

self.addEventListener('message', async (event) => {
  if (event.data?.type !== 'DOWNLOAD_BRAC_TILES') return

  const { styleUrl } = event.data
  const bounds = event.data.bounds || DEFAULT_BRAC_BOUNDS
  const zoomLevels = event.data.zoomLevels || DEFAULT_ZOOM_LEVELS
  const client = event.source
  const cache = await caches.open(TILE_CACHE_NAME)

  let cancelled = false
  const cancelListener = (cancelEvent) => {
    if (cancelEvent.data?.type === 'CANCEL_DOWNLOAD') cancelled = true
  }
  self.addEventListener('message', cancelListener)

  try {
    if (!styleUrl) {
      client.postMessage({ type: 'DOWNLOAD_ERROR', message: 'No styleUrl provided.' })
      return
    }

    client.postMessage({ type: 'DOWNLOAD_PROGRESS', phase: 'style', downloaded: 0, total: 0, failed: 0 })

    const styleResponse = await fetch(styleUrl)
    if (!styleResponse.ok) {
      client.postMessage({ type: 'DOWNLOAD_ERROR', message: `Could not load style (${styleResponse.status}).` })
      return
    }
    // clone() must happen before the body is read — cloning an
    // already-consumed Response throws ("body is already used").
    await cache.put(styleUrl, styleResponse.clone())
    const style = await styleResponse.json()

    // Resolve every source's real tile template up front.
    const sourceEntries = Object.entries(style.sources || {})
    const resolvedSources = []
    for (const [sourceId, sourceDef] of sourceEntries) {
      const tileset = await resolveSourceTileset(sourceDef)
      if (tileset) resolvedSources.push({ sourceId, ...tileset })
    }

    // Sprite (icons used by the style) — one JSON + one PNG, 1x is enough.
    const spriteUrls = []
    if (style.sprite) {
      spriteUrls.push(`${style.sprite}.json`, `${style.sprite}.png`)
    }

    // Glyphs (label fonts) — ranges 0-255 and 256-511 cover Latin + Latin
    // Extended-A, which is enough for this app's Croatian place names.
    const glyphUrls = []
    if (style.glyphs) {
      const fontStacks = collectFontStacks(style.layers)
      for (const fontStack of fontStacks) {
        for (const range of ['0-255', '256-511']) {
          glyphUrls.push(
            style.glyphs.replace('{fontstack}', encodeURIComponent(fontStack)).replace('{range}', range)
          )
        }
      }
    }

    // Build the full tile URL list, respecting each source's own zoom range.
    const tileUrls = []
    for (const zoom of zoomLevels) {
      const xMin = lng2tile(bounds.minLng, zoom)
      const xMax = lng2tile(bounds.maxLng, zoom)
      const yMin = lat2tile(bounds.maxLat, zoom)
      const yMax = lat2tile(bounds.minLat, zoom)

      for (const source of resolvedSources) {
        if (zoom < source.minzoom || zoom > source.maxzoom) continue
        for (let x = xMin; x <= xMax; x += 1) {
          for (let y = yMin; y <= yMax; y += 1) {
            tileUrls.push(buildTileUrl(source.template, zoom, x, y))
          }
        }
      }
    }

    const total = tileUrls.length + spriteUrls.length + glyphUrls.length
    let downloaded = 0
    let failed = 0

    const reportProgress = (force) => {
      if (!force && (downloaded + failed) % PROGRESS_REPORT_EVERY !== 0) return
      client.postMessage({ type: 'DOWNLOAD_PROGRESS', phase: 'tiles', downloaded, failed, total })
    }

    reportProgress(true)

    for (const url of [...spriteUrls, ...glyphUrls]) {
      if (cancelled) break
      const ok = await cacheUrl(cache, url)
      if (ok) downloaded += 1
      else failed += 1
    }
    reportProgress(true)

    if (!cancelled) {
      await runWithConcurrency(tileUrls, TILE_FETCH_CONCURRENCY, async (url) => {
        if (cancelled) return
        const ok = await cacheUrl(cache, url)
        if (ok) downloaded += 1
        else failed += 1
        reportProgress(false)
      })
    }

    reportProgress(true)
    client.postMessage({
      type: cancelled ? 'DOWNLOAD_CANCELLED' : 'DOWNLOAD_COMPLETE',
      downloaded,
      failed,
      total,
    })
  } catch (error) {
    // Without this, a rejected fetch (network error, CORS, etc.) throws
    // inside this async message-listener callback and becomes an unhandled
    // rejection in the *service worker's own* console — invisible to the
    // page — so the page's UI just hangs waiting for a message that never
    // arrives. Surface it instead.
    client.postMessage({ type: 'DOWNLOAD_ERROR', message: error?.message || String(error) })
  } finally {
    self.removeEventListener('message', cancelListener)
  }
})
