import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Map, { Layer, Marker, Popup, Source } from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './TrailsPage.css'
import '../App.css'
import BottomSheet from '../components/BottomSheet'
import ReportProblem from '../components/ReportProblem'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'

// Ensure your Supabase client is imported correctly
import { supabase } from '../supabaseClient.js'
// Import dynamic POIs
import finalPlacesData from '../final_places.json'
import { haversineDistanceKm } from '../utils/geo'
import useNavigationMode from '../hooks/useNavigationMode'
import NavigationHud from '../components/NavigationHud'
import RideSummaryModal from '../components/RideSummaryModal'

// User-friendly labels and icons for POI categories
const POI_METADATA = {
  viewpoint: { label: 'Viewpoints', color: '#FF5722' },
  beach_cove: { label: 'Beaches', color: '#00BCD4' },
  geological: { label: 'Caves & Geology', color: '#795548' },
  archaeology: { label: 'History', color: '#607D8B' },
  monastery: { label: 'Churches', color: '#E91E63' },
  water: { label: 'Water Reservoirs', color: '#2196F3' },
}

const iconButtonStyle = {
  background: '#370063',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  width: '45px',
  height: '45px',
  borderRadius: '50%',
  cursor: 'pointer',
  boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background-color 0.2s ease',
}

// Fallback keeps the map working in production if the env var isn't configured on the host.
const MAPTILER_FALLBACK_KEY = 'TjtNydvQmJJGJOelz7ji'
const MAPTILER_API_KEY = import.meta.env.VITE_MAPTILER_API_KEY || import.meta.env.VITE_MAPTILER_KEY || MAPTILER_FALLBACK_KEY
if (!import.meta.env.VITE_MAPTILER_API_KEY && !import.meta.env.VITE_MAPTILER_KEY) {
  console.error('VITE_MAPTILER_API_KEY is not set; falling back to the built-in MapTiler key.')
}
const MAPTILER_STYLE_ID = '019fd2b1-1969-70ee-bdd2-bceb14957863'
const MAPTILER_STREET_STYLE_URL = `https://api.maptiler.com/maps/${MAPTILER_STYLE_ID}/style.json?key=${MAPTILER_API_KEY}`
const MAPTILER_SATELLITE_STYLE_URL = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_API_KEY}`

// Plain OpenStreetMap raster tiles as a minimal MapLibre style spec — no vector
// sources/terrain available on this layer, so the 3D toggle falls back to a
// pitch-only view (no elevation exaggeration) whenever this base map is active.
const OSM_RASTER_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    { id: 'osm-tiles', type: 'raster', source: 'osm' },
  ],
}

// The DEM source name that ships with the MapTiler style — required by
// map.setTerrain(); OSM/satellite layers don't have it, so 3D there is tilt-only.
const MAPTILER_TERRAIN_SOURCE = 'terrain-rgb'

const BASE_MAP_STYLES = {
  maptiler: MAPTILER_STREET_STYLE_URL,
  satellite: MAPTILER_SATELLITE_STYLE_URL,
  osm: OSM_RASTER_STYLE,
}

const BASE_MAP_OPTIONS = [
  { id: 'maptiler', label: 'Vector' },
  { id: 'osm', label: 'OpenStreetMap' },
  { id: 'satellite', label: 'Satellite' },
]

// Keep the map locked to Brač Island — no panning to the mainland/other
// islands, no zooming out to a world view.
const BRAC_BOUNDS = [
  [16.20, 43.20], // SW [lng, lat]
  [16.90, 43.45], // NE [lng, lat]
]
const BRAC_CENTER = { longitude: 16.55, latitude: 43.32 }
const BRAC_MIN_ZOOM = 10
const BRAC_MAX_ZOOM = 18

// Resolve public assets against the app's deployed base path so fetches still
// work when the SPA is served from a nested production route (e.g. /trails).
function resolvePublicAsset(path) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  return `${base}/${String(path).replace(/^\//, '')}`
}

const GPX_DIFFICULTY_COLORS = {
  easy: '#4ade80',
  medium: '#facc15',
  hard: '#f97316',
}

const LINE_LAYER_BASE = {
  type: 'line',
  paint: {
    'line-width': 4,
    'line-opacity': 0.9,
  },
}

function toLineFeature(latLngPairs = []) {
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: latLngPairs.map(([lat, lng]) => [lng, lat]),
    },
  }
}

function toPointFeature(lat, lng) {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [lng, lat],
    },
  }
}

function computeBoundsFromLatLngs(latLngPairs = []) {
  if (!Array.isArray(latLngPairs) || latLngPairs.length === 0) return null
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity

  latLngPairs.forEach(([lat, lng]) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
  })

  if (!Number.isFinite(minLat) || !Number.isFinite(minLng) || !Number.isFinite(maxLat) || !Number.isFinite(maxLng)) {
    return null
  }

  return [[minLng, minLat], [maxLng, maxLat]]
}

function parseGpxTrack(gpxText) {
  const parser = new DOMParser()
  const xml = parser.parseFromString(gpxText, 'application/xml')
  const points = Array.from(xml.getElementsByTagName('trkpt'))

  const track = points
    .map((node) => {
      const lat = Number(node.getAttribute('lat'))
      const lng = Number(node.getAttribute('lon'))
      const eleNode = node.getElementsByTagName('ele')[0]
      const elevation = eleNode ? Number(eleNode.textContent) : 0
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return { lat, lng, elevation: Number.isFinite(elevation) ? elevation : 0 }
    })
    .filter(Boolean)

  if (track.length === 0) {
    return {
      rawPath: [],
      elevationData: [],
      distance: 0,
      elevationGain: 0,
      elevationLoss: 0,
      elevationMin: 0,
      elevationMax: 0,
    }
  }

  let distance = 0
  let elevationGain = 0
  let elevationLoss = 0
  let elevationMin = track[0].elevation
  let elevationMax = track[0].elevation

  const elevationData = []
  track.forEach((point, index) => {
    if (index > 0) {
      const prev = track[index - 1]
      distance += haversineDistanceKm([prev.lat, prev.lng], [point.lat, point.lng])
      const deltaEle = point.elevation - prev.elevation
      if (deltaEle > 0) elevationGain += deltaEle
      if (deltaEle < 0) elevationLoss += Math.abs(deltaEle)
    }
    elevationMin = Math.min(elevationMin, point.elevation)
    elevationMax = Math.max(elevationMax, point.elevation)
    elevationData.push({
      distance: Number(distance.toFixed(1)),
      elevation: Math.round(point.elevation),
      lat: point.lat,
      lng: point.lng,
    })
  })

  return {
    rawPath: track.map((point) => [point.lat, point.lng]),
    elevationData,
    distance,
    elevationGain,
    elevationLoss,
    elevationMin,
    elevationMax,
  }
}

function timeAgo(iso) {
  const then = new Date(iso).getTime()
  const diff = Math.floor((Date.now() - then) / 1000)
  if (diff < 60) return `${diff} sec ago`
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
  return `${Math.floor(diff / 86400)} days ago`
}

const MOVING_SPEED_THRESHOLD_KMH = 0.5

// Recorded track points only carry lat/lng/altitude/timestamp (no raw GPS
// speed), so per-interval speed for the moving-time check is derived from
// consecutive-point distance/time deltas rather than coords.speed.
function computeRideStats(trackPoints, startTime) {
  const elapsedTime = startTime ? Math.round((Date.now() - startTime) / 1000) : 0

  let totalDistance = 0
  let elevationGain = 0
  let movingTimeSec = 0
  let maxElevation = trackPoints.length > 0 && Number.isFinite(trackPoints[0].altitude) ? trackPoints[0].altitude : 0
  const elevationProfile = []

  trackPoints.forEach((point, index) => {
    const altitude = Number.isFinite(point.altitude) ? point.altitude : 0
    maxElevation = Math.max(maxElevation, altitude)

    if (index > 0) {
      const prev = trackPoints[index - 1]
      const segmentKm = haversineDistanceKm([prev.lat, prev.lng], [point.lat, point.lng])
      totalDistance += segmentKm

      const prevAltitude = Number.isFinite(prev.altitude) ? prev.altitude : 0
      const deltaAltitude = altitude - prevAltitude
      if (deltaAltitude > 0) elevationGain += deltaAltitude

      const deltaSeconds = (point.timestamp - prev.timestamp) / 1000
      if (deltaSeconds > 0) {
        const speedKmh = segmentKm / (deltaSeconds / 3600)
        if (speedKmh > MOVING_SPEED_THRESHOLD_KMH) {
          movingTimeSec += deltaSeconds
        }
      }
    }

    elevationProfile.push({
      distance: Number(totalDistance.toFixed(2)),
      elevation: Math.round(altitude),
      lat: point.lat,
      lng: point.lng,
    })
  })

  return {
    totalDistance,
    elapsedTime,
    movingTime: Math.round(movingTimeSec),
    elevationGain,
    maxElevation,
    elevationProfile,
  }
}

function RouteElevationChart({ data, chartColor, onHover }) {
  if (!Array.isArray(data) || data.length === 0) return null

  return (
    <div className="elevation-chart-container">
      <h4>Elevation Profile</h4>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart
          data={data}
          onMouseMove={(state) => {
            if (state && state.activeTooltipIndex != null) {
              const index = parseInt(state.activeTooltipIndex, 10)
              const point = data[index]
              if (point && point.lat != null && point.lng != null) {
                onHover?.(point)
                return
              }
            }
            onHover?.(null)
          }}
          onMouseLeave={() => onHover?.(null)}
        >
          <defs>
            <linearGradient id="customRouteElevationGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor} stopOpacity={0.8} />
              <stop offset="95%" stopColor={chartColor} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.18} />
          <XAxis
            dataKey="distance"
            stroke="#f8fafc"
            tick={{ fill: '#f8fafc', fontSize: 12 }}
            label={{ value: 'Distance (km)', position: 'insideBottomRight', offset: -5, fill: '#f8fafc' }}
          />
          <YAxis
            stroke="#f8fafc"
            tick={{ fill: '#f8fafc', fontSize: 12 }}
            label={{ value: 'Elevation (m)', angle: -90, position: 'insideLeft', fill: '#f8fafc' }}
          />
          <RechartsTooltip
            contentStyle={{ backgroundColor: '#1f0931', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px' }}
            labelStyle={{ color: '#f8fafc' }}
            itemStyle={{ color: '#f8fafc' }}
            formatter={(value) => [Number(value).toFixed(0) + ' m', 'Elevation']}
          />
          <Area
            type="monotone"
            dataKey="elevation"
            stroke={chartColor}
            fillOpacity={1}
            fill="url(#customRouteElevationGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function createWaypoint(seed) {
  return {
    id: `wp-${Date.now()}-${seed}-${Math.random().toString(36).slice(2, 8)}`,
    latlng: null,
    address: '',
  }
}

export default function TrailsPage() {
  const [trails, setTrails] = useState([])
  const [selectedTrail, setSelectedTrail] = useState(null)
  const [trailStats, setTrailStats] = useState({})
  const [hoverPosition, setHoverPosition] = useState(null)
  const [reportsRefreshKey, setReportsRefreshKey] = useState(0)
  const [plannerTab, setPlannerTab] = useState('routes')
  
  // Custom Planning states
  const [waypoints, setWaypoints] = useState([createWaypoint(1), createWaypoint(2)])
  const [roadPreference, setRoadPreference] = useState('gravel')
  const [routeDifficulty, setRouteDifficulty] = useState('moderate')
  const [avoidHikingTrails, setAvoidHikingTrails] = useState(true)
  const [activePinningIndex, setActivePinningIndex] = useState(null)
  const [waypointSearchLoadingIndex, setWaypointSearchLoadingIndex] = useState(null)
  const [routeGeometry, setRouteGeometry] = useState([])
  const [routePlannerStats, setRoutePlannerStats] = useState(null)
  const [routeError, setRouteError] = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)

  // Community & Saved Routes states
  const [selectedCommunityRoute, setSelectedCommunityRoute] = useState(null)
  const [communityRoutePositions, setCommunityRoutePositions] = useState([])
  
  // Map settings
  const [mapStyle, setMapStyle] = useState('maptiler')
  const [is3D, setIs3D] = useState(false)
  const [showLayerMenu, setShowLayerMenu] = useState(false)
  const [mapDownload, setMapDownload] = useState({ status: 'idle', downloaded: 0, failed: 0, total: 0 })

  // POI & Pill States
  const [showPoiMenu, setShowPoiMenu] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState([])
  
  const [activeRecording, setActiveRecording] = useState(false)
  const [isDropPinMode, setIsDropPinMode] = useState(false)
  const [reportCoordinates, setReportCoordinates] = useState(null)
  const [routeFeedbackRefreshKey, setRouteFeedbackRefreshKey] = useState(0)
  const [selectedTrailCommunityData, setSelectedTrailCommunityData] = useState(null)

  // Navigate mode
  const [navigationModeActive, setNavigationModeActive] = useState(false)
  const [activeNavigationPath, setActiveNavigationPath] = useState(null)
  const [pendingNavTarget, setPendingNavTarget] = useState(null)
  const [collapseRequestToken, setCollapseRequestToken] = useState(null)
  // Camera auto-follows the rider during navigation until they manually pan/pinch,
  // at which point it backs off and a Recenter button appears to resume it.
  const [autoFollowPaused, setAutoFollowPaused] = useState(false)
  const nav = useNavigationMode()

  const mapRef = useRef(null)
  const reportProblemRef = useRef(null)
  const lastWaypointPlacementIndexRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const longPressPointRef = useRef(null)

  const [reports, setReports] = useState([])
  const [selectedReportId, setSelectedReportId] = useState(null)
  const [selectedPoiId, setSelectedPoiId] = useState(null)
  const [gpsPosition, setGpsPosition] = useState(null)
  const [gpsTrackPoints, setGpsTrackPoints] = useState([])

  // Ride recording / post-ride summary
  const [rideStartTime, setRideStartTime] = useState(null)
  const [rideMovingTime, setRideMovingTime] = useState(0)
  const [showRideSummary, setShowRideSummary] = useState(false)
  const [completedRideStats, setCompletedRideStats] = useState(null)

  const normalizedPois = useMemo(() => {
    const rawItems = Array.isArray(finalPlacesData)
      ? finalPlacesData
      : finalPlacesData?.features || []

    return rawItems
      .map((item, index) => {
        const properties = item?.properties || item || {}
        const geometry = item?.geometry || null
        const geometryCoords = Array.isArray(geometry?.coordinates) ? geometry.coordinates : null
        const flatCoords = item?.coordinates || null

        const lat = flatCoords?.lat ?? (Array.isArray(geometryCoords) ? geometryCoords[1] : null)
        const lng = flatCoords?.lng ?? (Array.isArray(geometryCoords) ? geometryCoords[0] : null)

        if (lat == null || lng == null) {
          return null
        }

        return {
          id: properties.id || properties.fid || `poi-${index}`,
          name: properties['name-en'] || properties.name || 'Unnamed place',
          category: (properties.category || properties.Category || 'other').toString().toLowerCase().replace(/\s+/g, '_'),
          coordinates: { lat, lng },
        }
      })
      .filter(Boolean)
  }, [])

  // Get unique categories from final_places.json
  const availableCategories = useMemo(() => {
    if (!normalizedPois.length) return []
    const unique = new Set(normalizedPois.map((poi) => poi.category).filter(Boolean))
    return Array.from(unique)
  }, [normalizedPois])

  // Filter dynamic POIs
  const filteredPois = useMemo(() => {
    if (selectedCategories.length === 0) return []
    return normalizedPois.filter((poi) => selectedCategories.includes(poi.category))
  }, [normalizedPois, selectedCategories])

  const selectedTrailMeta = useMemo(
    () => trails.find((trail) => trail.filename === selectedTrail) || null,
    [selectedTrail, trails]
  )

  const selectedTrailPath = useMemo(
    () => trailStats?.[selectedTrail]?.rawPath || [],
    [selectedTrail, trailStats]
  )

  const remainingPath = useMemo(
    () => Array.isArray(nav.remainingPath) ? nav.remainingPath : [],
    [nav.remainingPath]
  )

  const getMapInstance = useCallback(() => mapRef.current?.getMap?.() || null, [])

  // Camera auto-follows the rider's GPS fix during navigation. Paused as soon
  // as the rider manually pans/pinches (see handleUserMapInteractionStart)
  // until they tap Recenter, so it never fights a manual gesture.
  useEffect(() => {
    if (!navigationModeActive || autoFollowPaused || !nav.userPosition) return
    const map = getMapInstance()
    if (!map) return
    const [lat, lng] = nav.userPosition
    map.panTo([lng, lat], { duration: 500 })
  }, [navigationModeActive, autoFollowPaused, nav.userPosition, getMapInstance])

  // The MapTiler style we use ships with globe projection + 3D terrain enabled.
  // MapLibre GL fails to paint any tiles under that combination here (data loads
  // fine, but the canvas stays a blank background color) — always force a flat
  // mercator projection. Terrain itself is fine under mercator, so it's only
  // re-applied here when the 3D toggle is on (and the active base map actually
  // has the DEM source) — this also re-establishes both after a base-map switch,
  // since map.setStyle() wipes projection/terrain along with the old style.
  const handleMapLoad = useCallback((event) => {
    const map = event?.target
    if (!map) return

    // Guard every call against the current actual state before calling
    // setProjection/setTerrain — this fires on every 'styledata' event, and
    // those setters can themselves trigger further 'styledata' events, so an
    // unconditional call here would feed back into itself and hang the tab.
    if (map.getProjection?.()?.type !== 'mercator') {
      map.setProjection({ type: 'mercator' })
    }

    const hasTerrainSource = !!map.getSource(MAPTILER_TERRAIN_SOURCE)
    const currentTerrain = map.getTerrain?.()
    if (is3D && hasTerrainSource) {
      if (!currentTerrain || currentTerrain.source !== MAPTILER_TERRAIN_SOURCE) {
        map.setTerrain({ source: MAPTILER_TERRAIN_SOURCE, exaggeration: 1.4 })
      }
    } else if (currentTerrain) {
      map.setTerrain(null)
    }
  }, [is3D])

  const handleToggleLayerMenu = useCallback(() => {
    setShowLayerMenu((prev) => !prev)
    setShowPoiMenu(false)
  }, [])

  // Listens for progress/completion messages the service worker posts back
  // while it's pre-fetching offline map tiles (see handleDownloadMap below).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined

    const handleMessage = (event) => {
      const { type } = event.data || {}
      if (type === 'DOWNLOAD_PROGRESS') {
        setMapDownload({ status: 'downloading', downloaded: event.data.downloaded, failed: event.data.failed, total: event.data.total })
      } else if (type === 'DOWNLOAD_COMPLETE') {
        setMapDownload({ status: 'complete', downloaded: event.data.downloaded, failed: event.data.failed, total: event.data.total })
      } else if (type === 'DOWNLOAD_CANCELLED') {
        setMapDownload({ status: 'idle', downloaded: 0, failed: 0, total: 0 })
      } else if (type === 'DOWNLOAD_ERROR') {
        setMapDownload({ status: 'error', downloaded: 0, failed: 0, total: 0, message: event.data.message })
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage)
  }, [])

  const handleDownloadMap = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      alert('Offline maps are not supported in this browser.')
      return
    }

    setMapDownload({ status: 'downloading', downloaded: 0, failed: 0, total: 0 })

    // clients.claim() in the SW's activate handler means an existing tab can
    // be taken over without a reload — but only after activation has run at
    // least once, so the very first visit may still need a moment.
    const registration = await navigator.serviceWorker.ready
    const controller = navigator.serviceWorker.controller || registration.active
    if (!controller) {
      setMapDownload({ status: 'error', downloaded: 0, failed: 0, total: 0, message: 'Map download isn\'t ready yet — please try again in a moment.' })
      return
    }

    controller.postMessage({ type: 'DOWNLOAD_BRAC_TILES', styleUrl: MAPTILER_STREET_STYLE_URL })
  }, [])

  const handleCancelDownloadMap = useCallback(() => {
    navigator.serviceWorker?.controller?.postMessage({ type: 'CANCEL_DOWNLOAD' })
  }, [])

  const handleSelectBaseMap = useCallback((id) => {
    // Disable terrain before swapping styles: MapLibre tears down the DEM
    // shaders as part of setStyle(), and if terrain is still active going
    // into a style that changes/drops the DEM source, that teardown throws
    // (leaves a blank canvas). handleMapLoad re-enables it after the new
    // style loads, if the new style has the source and 3D is still on.
    const map = getMapInstance()
    if (map) {
      map.setTerrain(null)
    }
    setMapStyle(id)
    setShowLayerMenu(false)
  }, [getMapInstance])

  // Pitch/bearing tilt works on any base map; terrain exaggeration only applies
  // when the active style actually ships the MapTiler DEM source (not OSM raster).
  const handleToggle3D = useCallback(() => {
    const map = getMapInstance()
    setIs3D((prev) => {
      const next = !prev
      if (map) {
        if (next) {
          map.easeTo({ pitch: 60, bearing: -15, duration: 1000 })
          if (map.getSource(MAPTILER_TERRAIN_SOURCE)) {
            map.setTerrain({ source: MAPTILER_TERRAIN_SOURCE, exaggeration: 1.4 })
          }
        } else {
          map.easeTo({ pitch: 0, bearing: 0, duration: 1000 })
          map.setTerrain(null)
        }
      }
      return next
    })
  }, [getMapInstance])

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    longPressPointRef.current = null
  }, [])

  useEffect(() => clearLongPressTimer, [clearLongPressTimer])

  useEffect(() => {
    let mounted = true
    const tracksUrl = resolvePublicAsset('tracks/tracks.json')
    fetch(tracksUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load tracks.json: ${response.status}`)
        }
        return response.json()
      })
      .then((data) => {
        if (mounted) setTrails(Array.isArray(data) ? data : [])
      })
      .catch((error) => {
        console.error(`Error fetching tracks.json from ${tracksUrl}:`, error)
        if (mounted) setTrails([])
      })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const loadReports = async () => {
      const { data, error } = await supabase
        .from('road_reports')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to load reports:', error)
        setReports([])
        return
      }

      setReports(data || [])
    }

    loadReports()
  }, [reportsRefreshKey])

  useEffect(() => {
    if (!navigator.geolocation) return undefined

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGpsPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          timestamp: position.timestamp,
        })
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  // Mirrors gpsPosition into a ref so the recording interval below can read the
  // latest fix without depending on gpsPosition directly — depending on it
  // would recreate the interval (and reset its 3s timer) on every GPS update,
  // which arrive more often than 3s in practice, so the interval would almost
  // never survive long enough to fire.
  const gpsPositionRef = useRef(null)
  useEffect(() => {
    gpsPositionRef.current = gpsPosition
  }, [gpsPosition])

  useEffect(() => {
    if (!activeRecording) return undefined

    const interval = window.setInterval(() => {
      setGpsTrackPoints((prev) => {
        const position = gpsPositionRef.current
        if (!position) return prev
        return [
          ...prev,
          {
            lat: position.lat,
            lng: position.lng,
            altitude: position.altitude,
            timestamp: position.timestamp,
          },
        ]
      })
    }, 3000)

    return () => {
      clearInterval(interval)
    }
  }, [activeRecording])

  useEffect(() => {
    if (!selectedTrail) return
    if (plannerTab !== 'routes') return
    if (selectedCommunityRoute) return

    const activeTrack = trails.find((track) => track.filename === selectedTrail)
    if (!activeTrack) return

    let cancelled = false

    const loadGpx = async () => {
      const gpxUrl = resolvePublicAsset(`tracks/${activeTrack.filename}`)
      try {
        const response = await fetch(gpxUrl)
        if (!response.ok) {
          throw new Error(`Failed to load GPX: ${response.status}`)
        }
        const gpxText = await response.text()
        const parsed = parseGpxTrack(gpxText)
        if (cancelled) return

        setTrailStats((prev) => ({
          ...prev,
          [activeTrack.filename]: {
            distance: parsed.distance,
            elevationGain: parsed.elevationGain,
            elevationLoss: parsed.elevationLoss,
            elevationMax: parsed.elevationMax,
            elevationMin: parsed.elevationMin,
            elevationData: parsed.elevationData,
            rawPath: parsed.rawPath,
          },
        }))

        const bounds = computeBoundsFromLatLngs(parsed.rawPath)
        const map = getMapInstance()
        if (bounds && map) {
          map.fitBounds(bounds, { padding: 50, duration: 1200 })
        }
      } catch (error) {
        console.error(`Failed to load/parse GPX track from ${gpxUrl}:`, error)
      }
    }

    loadGpx()

    return () => {
      cancelled = true
    }
  }, [getMapInstance, plannerTab, selectedCommunityRoute, selectedTrail, trails])

  const handleToggleCategory = (category) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category) 
        : [...prev, category]
    )
    setShowPoiMenu(false)
  }

  const handleTogglePoiMenu = () => {
    const nextState = !showPoiMenu
    setShowPoiMenu(nextState)
    setShowLayerMenu(false)
    if (nextState) {
      setSelectedCategories([])
    }
  }

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        if (mapRef.current) {
          mapRef.current.flyTo({ center: [longitude, latitude], zoom: 18, duration: 1500 })
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          alert('Please enable location access to use this feature.')
        } else {
          alert('Unable to retrieve your location.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  const handleReportProblem = useCallback(() => {
    setIsDropPinMode(false)
    if (reportProblemRef.current?.openModal) {
      reportProblemRef.current.openModal()
    }
  }, [])

  const handleDropPinRequest = useCallback(() => {
    setIsDropPinMode(true)
  }, [])

  const handleMapReportPinPick = useCallback((coords) => {
    setReportCoordinates(coords)
    setIsDropPinMode(false)
    if (reportProblemRef.current?.openModal) {
      reportProblemRef.current.openModal(coords)
    }
  }, [])

  const handleTrailClick = useCallback((trail) => {
    // Selecting a GPX trail should replace whatever was previously shown —
    // otherwise a lingering selectedCommunityRoute (e.g. from viewing a user
    // route and backing out without clearing it) silently blocks this GPX
    // trail's stats from loading at all, via the guard in the effect below.
    setSelectedCommunityRoute(null)
    setCommunityRoutePositions([])
    setSelectedTrail(trail.filename)
  }, [])

  const getTrailIdentifier = useCallback((trail) => {
    if (!trail) return null
    if (trail.gpx_path_identifier) return trail.gpx_path_identifier
    if (trail.filename) return trail.filename
    if (trail.name) {
      return trail.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    }
    return null
  }, [])

  useEffect(() => {
    if (!selectedTrail) {
      setSelectedTrailCommunityData(null)
      return
    }

    const trail = trails.find((item) => item.filename === selectedTrail)
    if (!trail) {
      setSelectedTrailCommunityData(null)
      return
    }

    const trailIdentifier = getTrailIdentifier(trail)
    if (!trailIdentifier) {
      setSelectedTrailCommunityData(null)
      return
    }

    const currentStats = trailStats?.[selectedTrail]
    const staticDistance = Number(currentStats?.distance || trail.distance || trail.distance_km || 0)
    const staticElevation = Number(currentStats?.elevationMax || currentStats?.elevationGain || trail.elevation || 0)
    const staticWaypoints = Array.isArray(currentStats?.elevationData)
      ? currentStats.elevationData
          .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
          .map((point) => ({ lat: point.lat, lng: point.lng }))
      : []

    let cancelled = false

    const syncAndFetchCommunityData = async () => {
      setSelectedTrailCommunityData((prev) => ({
        routeId: prev?.routeId || null,
        loading: true,
        error: null,
        averageRating: prev?.averageRating ?? null,
        completionCount: prev?.completionCount ?? 0,
        reviews: prev?.reviews || [],
      }))

      let routeRow = null
      const { data: existingRoute, error: existingRouteError } = await supabase
        .from('shared_routes')
        .select('id, gpx_path_identifier, name')
        .eq('gpx_path_identifier', trailIdentifier)
        .maybeSingle()

      if (existingRouteError) {
        if (!cancelled) {
          setSelectedTrailCommunityData({
            routeId: null,
            loading: false,
            error: 'Could not sync route with database.',
            averageRating: null,
            completionCount: 0,
            reviews: [],
          })
        }
        return
      }

      routeRow = existingRoute

      if (!routeRow) {
        const { data: insertedRoute, error: insertError } = await supabase
          .from('shared_routes')
          .insert([
            {
              gpx_path_identifier: trailIdentifier,
              name: trail.name || trailIdentifier,
              distance_km: Number.isFinite(staticDistance) ? staticDistance : null,
              elevation_max: Number.isFinite(staticElevation) ? staticElevation : null,
              waypoints: staticWaypoints,
            },
          ])
          .select('id, gpx_path_identifier, name')
          .single()

        if (insertError) {
          if (!cancelled) {
            setSelectedTrailCommunityData({
              routeId: null,
              loading: false,
              error: 'Could not create shared route entry.',
              averageRating: null,
              completionCount: 0,
              reviews: [],
            })
          }
          return
        }

        routeRow = insertedRoute
      }

      const routeId = routeRow?.id
      if (!routeId) {
        if (!cancelled) {
          setSelectedTrailCommunityData({
            routeId: null,
            loading: false,
            error: 'Route synchronization returned an invalid route id.',
            averageRating: null,
            completionCount: 0,
            reviews: [],
          })
        }
        return
      }

      const [reviewsResult, completionsResult] = await Promise.all([
        supabase
          .from('route_reviews')
          .select('id, rating, comment, created_at')
          .eq('route_id', routeId)
          .order('created_at', { ascending: false }),
        supabase
          .from('completed_rides')
          .select('id', { count: 'exact', head: true })
          .eq('route_id', routeId),
      ])

      if (!cancelled) {
        const reviews = reviewsResult.data || []
        const numericRatings = reviews
          .map((review) => Number(review.rating))
          .filter((value) => Number.isFinite(value))

        setSelectedTrailCommunityData({
          routeId,
          loading: false,
          error: reviewsResult.error ? 'Could not load route reviews.' : null,
          averageRating: numericRatings.length > 0
            ? numericRatings.reduce((sum, value) => sum + value, 0) / numericRatings.length
            : null,
          completionCount: completionsResult.count || 0,
          reviews,
        })
      }
    }

    syncAndFetchCommunityData()

    return () => {
      cancelled = true
    }
  }, [getTrailIdentifier, routeFeedbackRefreshKey, selectedTrail, supabase, trailStats, trails])

  const waypointCoordinates = useMemo(
    () => waypoints
      .map((waypoint) => waypoint.latlng)
      .filter((latlng) => Array.isArray(latlng) && Number.isFinite(latlng[0]) && Number.isFinite(latlng[1])),
    [waypoints]
  )

  const updateWaypointLatLng = useCallback((index, nextLat, nextLng) => {
    setWaypoints((prev) => prev.map((waypoint, idx) => {
      if (idx !== index) return waypoint

      const hasLat = Number.isFinite(nextLat)
      const hasLng = Number.isFinite(nextLng)
      return {
        ...waypoint,
        latlng: hasLat && hasLng ? [nextLat, nextLng] : null,
      }
    }))
  }, [])

  const handleAddWaypoint = useCallback(() => {
    setWaypoints((prev) => [...prev, createWaypoint(prev.length + 1)])
  }, [])

  const updateWaypointCoordsAndAddress = useCallback((index, nextLat, nextLng, nextAddress = null) => {
    setWaypoints((prev) => prev.map((waypoint, idx) => {
      if (idx !== index) return waypoint

      return {
        ...waypoint,
        latlng: Number.isFinite(nextLat) && Number.isFinite(nextLng) ? [nextLat, nextLng] : waypoint.latlng,
        address: nextAddress ?? waypoint.address,
      }
    }))
  }, [])

  const handleWaypointAddressChange = useCallback((index, value) => {
    setWaypoints((prev) => prev.map((waypoint, idx) => (
      idx === index ? { ...waypoint, address: value } : waypoint
    )))
  }, [])

  const geocodeWaypointAddress = useCallback(async (index, address) => {
    const query = address.trim()
    if (!query) return

    setWaypointSearchLoadingIndex(index)
    setRouteError(null)

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
      const data = await response.json()

      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0]
        updateWaypointCoordsAndAddress(index, parseFloat(lat), parseFloat(lon), display_name)
      } else {
        setRouteError('Could not find that address. Please try a more specific search.')
      }
    } catch {
      setRouteError('Address lookup failed. Please try again.')
    } finally {
      setWaypointSearchLoadingIndex(null)
    }
  }, [updateWaypointCoordsAndAddress])

  const reverseGeocodeWaypoint = useCallback(async (index, lat, lng) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      const data = await response.json()
      if (data?.display_name) {
        updateWaypointCoordsAndAddress(index, lat, lng, data.display_name)
      } else {
        updateWaypointCoordsAndAddress(index, lat, lng)
      }
    } catch {
      updateWaypointCoordsAndAddress(index, lat, lng)
    }
  }, [updateWaypointCoordsAndAddress])

  const handleWaypointSearchKeyDown = useCallback((index, event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      geocodeWaypointAddress(index, waypoints[index]?.address || '')
    }
  }, [geocodeWaypointAddress, waypoints])

  const handleWaypointSearchClick = useCallback((index) => {
    geocodeWaypointAddress(index, waypoints[index]?.address || '')
  }, [geocodeWaypointAddress, waypoints])

  const handleWaypointPinClick = useCallback((index) => {
    setActivePinningIndex((current) => (current === index ? null : index))
  }, [])

  const placeWaypointAtCoords = useCallback((lat, lng, address = '', preferredIndex = null) => {
    setWaypoints((prev) => {
      const canUsePreferredIndex = Number.isInteger(preferredIndex) && preferredIndex >= 0 && preferredIndex < prev.length
      const emptyIndex = prev.findIndex((waypoint) => !waypoint.latlng)
      const targetIndex = canUsePreferredIndex
        ? preferredIndex
        : (emptyIndex === -1 ? prev.length : emptyIndex)
      lastWaypointPlacementIndexRef.current = targetIndex

      if (targetIndex === prev.length) {
        return [
          ...prev,
          {
            ...createWaypoint(prev.length + 1),
            latlng: [lat, lng],
            address,
          },
        ]
      }

      return prev.map((waypoint, idx) => (
        idx === targetIndex
          ? {
              ...waypoint,
              latlng: [lat, lng],
              address: address || waypoint.address,
            }
          : waypoint
      ))
    })
  }, [])

  const handleMapLongPress = useCallback(async (latlng) => {
    if (!latlng) return

    const targetIndex = Number.isInteger(activePinningIndex)
      ? activePinningIndex
      : null

    setActivePinningIndex(null)
    placeWaypointAtCoords(latlng.lat, latlng.lng, '', targetIndex)

    const resolvedTargetIndex = lastWaypointPlacementIndexRef.current

    if (navigator.vibrate) {
      navigator.vibrate([100])
    }

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`)
      const data = await response.json()
      if (data?.display_name) {
        if (resolvedTargetIndex != null) {
          setWaypoints((prev) => prev.map((waypoint, idx) => (
            idx === resolvedTargetIndex ? { ...waypoint, address: data.display_name } : waypoint
          )))
        }
      }
    } catch {
      // Reverse geocoding is optional; silently ignore failures.
    }
  }, [activePinningIndex, placeWaypointAtCoords])

  const handleMapWaypointPin = useCallback(async (index, coords) => {
    setActivePinningIndex(null)
    updateWaypointCoordsAndAddress(index, coords.lat, coords.lng)
    await reverseGeocodeWaypoint(index, coords.lat, coords.lng)
  }, [reverseGeocodeWaypoint, updateWaypointCoordsAndAddress])

  const handleMapClick = useCallback((event) => {
    const { lat, lng } = event.lngLat
    if (isDropPinMode) {
      handleMapReportPinPick({ lat, lng })
      return
    }
    if (activePinningIndex != null) {
      handleMapWaypointPin(activePinningIndex, { lat, lng })
    }
  }, [activePinningIndex, handleMapReportPinPick, handleMapWaypointPin, isDropPinMode])

  const handleMapPressStart = useCallback((event) => {
    if (plannerTab !== 'planNew') return
    clearLongPressTimer()
    longPressPointRef.current = { lat: event.lngLat.lat, lng: event.lngLat.lng }
    longPressTimerRef.current = window.setTimeout(() => {
      if (longPressPointRef.current) {
        handleMapLongPress(longPressPointRef.current)
      }
    }, 3000)
  }, [clearLongPressTimer, handleMapLongPress, plannerTab])

  const handleMapPressEnd = useCallback(() => {
    clearLongPressTimer()
  }, [clearLongPressTimer])

  const fetchElevationProfile = useCallback(async (coords) => {
    if (coords.length === 0) return []

    const step = Math.max(1, Math.ceil(coords.length / 30))
    const sampled = coords.filter((_, idx) => idx % step === 0)
    if (sampled[sampled.length - 1] !== coords[coords.length - 1]) {
      sampled.push(coords[coords.length - 1])
    }

    let cumulativeKm = 0
    const sampledWithDistance = sampled.map((point, idx) => {
      if (idx > 0) {
        cumulativeKm += haversineDistanceKm(sampled[idx - 1], point)
      }
      return { point, distKm: cumulativeKm }
    })

    try {
      const locations = sampled.map(([lat, lng]) => `${lat},${lng}`).join('|')
      const elevationResponse = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${encodeURIComponent(locations)}`)

      if (!elevationResponse.ok) {
        throw new Error('Elevation request failed')
      }

      const elevationData = await elevationResponse.json()
      return sampledWithDistance.map((entry, idx) => ({
        distKm: entry.distKm,
        elev: elevationData?.results?.[idx]?.elevation ?? 0,
      }))
    } catch {
      return sampledWithDistance.map((entry, idx) => ({
        distKm: entry.distKm,
        elev: 20 + idx * 5,
      }))
    }
  }, [])

  const parseBrouterProfilePoints = useCallback((profileSource, geometryCoords) => {
    if (Array.isArray(profileSource)) {
      return profileSource
        .map((entry, index) => {
          if (Array.isArray(entry)) {
            const [distanceValue, elevationValue] = entry
            const distanceKm = Number(distanceValue)
            const elevation = Number(elevationValue)
            if (Number.isFinite(distanceKm) && Number.isFinite(elevation)) {
              return { distKm: distanceKm, elev: elevation }
            }
            return null
          }

          if (entry && typeof entry === 'object') {
            const distanceKm = Number(entry.distKm ?? entry.distance ?? entry.distance_km ?? entry.x ?? index)
            const elevation = Number(entry.elev ?? entry.elevation ?? entry.y ?? entry.z)
            if (Number.isFinite(distanceKm) && Number.isFinite(elevation)) {
              return { distKm: distanceKm, elev: elevation }
            }
          }

          return null
        })
        .filter(Boolean)
    }

    if (Array.isArray(geometryCoords) && geometryCoords.some((point) => point.length >= 3)) {
      let cumulativeKm = 0
      return geometryCoords.map((point, index) => {
        if (index > 0) {
          cumulativeKm += haversineDistanceKm(
            [geometryCoords[index - 1][1], geometryCoords[index - 1][0]],
            [point[1], point[0]]
          )
        }

        return {
          distKm: cumulativeKm,
          elev: Number(point[2]) || 0,
        }
      })
    }

    return []
  }, [])

const getBrouterProfile = useCallback(() => {
  if (roadPreference === 'paved') {
    return 'trekking'
  }

  if (roadPreference === 'mixed') {
    return 'safety'
  }

  if (roadPreference === 'bike_tracks') {
    return 'fastbike'
  }

  if (roadPreference === 'gravel' && !avoidHikingTrails) {
    return 'mtb'
  }

  return 'gravel'
}, [avoidHikingTrails, roadPreference])

  const calculateRouteFromWaypoints = useCallback(async (coords) => {
    if (coords.length < 2) {
      setRouteGeometry([])
      setRoutePlannerStats(null)
      return
    }

    setRouteLoading(true)
    setRouteError(null)

    try {
      const coordinatesJoined = coords.map(([lat, lng]) => `${lng},${lat}`).join('|')
      const profile = getBrouterProfile()
      const routeResponse = await fetch(
        `https://brouter.de/brouter?lonlats=${encodeURIComponent(coordinatesJoined)}&profile=${profile}&alternativeidx=0&format=geojson`
      )

      let geometry
      let distanceKm
      let elevationProfile = []

      if (routeResponse.ok) {
        const brouterData = await routeResponse.json()
        const routeFeature = Array.isArray(brouterData?.features)
          ? brouterData.features[0]
          : brouterData?.feature || brouterData
        const routeGeometryCoords = routeFeature?.geometry?.coordinates || brouterData?.geometry?.coordinates || []
        const routeProperties = routeFeature?.properties || brouterData?.properties || {}

        if (!routeGeometryCoords.length) {
          throw new Error('No valid route returned')
        }

        // Detect straight-line fallback (only 2 points = start and end = no routing happened)
        if (routeGeometryCoords.length === 2) {
          console.warn('BRouter returned only 2 points - profile may not be supported, falling back to gravel')
          const fallbackResponse = await fetch(
            `https://brouter.de/brouter?lonlats=${encodeURIComponent(coordinatesJoined)}&profile=gravel&alternativeidx=0&format=geojson`
          )
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json()
            const fallbackFeature = Array.isArray(fallbackData?.features) ? fallbackData.features[0] : fallbackData
            const fallbackCoords = fallbackFeature?.geometry?.coordinates || []
            if (fallbackCoords.length > 2) {
              geometry = fallbackCoords.map((point) => [point[1], point[0]])
            }
          } else {
            geometry = routeGeometryCoords.map((point) => [point[1], point[0]])
          }
        } else {
          geometry = routeGeometryCoords.map((point) => [point[1], point[0]])
        }

        const propertyDistanceKm = Number(
          routeProperties.distance_km ??
          routeProperties.distanceKm ??
          routeProperties.distance ??
          routeProperties.track_length_km ??
          routeProperties.trackLengthKm ??
          routeProperties.length_km ??
          routeProperties.length
        )

        distanceKm = Number.isFinite(propertyDistanceKm)
          ? propertyDistanceKm
          : geometry.reduce((sum, point, idx) => {
              if (idx === 0) return 0
              return sum + haversineDistanceKm(geometry[idx - 1], point)
            }, 0)

        elevationProfile = parseBrouterProfilePoints(
          routeProperties.elevation_profile ??
          routeProperties.elevationProfile ??
          routeProperties.profile_elevation ??
          routeProperties.ele_profile ??
          routeProperties.profileEle ??
          routeProperties.elevation,
          routeGeometryCoords
        )
      } else {
        geometry = coords
        distanceKm = coords.reduce((sum, point, idx) => {
          if (idx === 0) return 0
          return sum + haversineDistanceKm(coords[idx - 1], point)
        }, 0)
      }

      if (elevationProfile.length === 0) {
        elevationProfile = await fetchElevationProfile(geometry)
      }

      const maxElevation = elevationProfile.length > 0
        ? Math.max(...elevationProfile.map((entry) => entry.elev))
        : null

      const elevationData = geometry.map((point, index) => {
        const ratioIndex = elevationProfile.length > 1 && geometry.length > 1
          ? Math.round((index / (geometry.length - 1)) * (elevationProfile.length - 1))
          : 0
        const profilePoint = elevationProfile[ratioIndex] || elevationProfile[index] || elevationProfile[0] || null

        return {
          distance: profilePoint?.distKm ?? (index > 0 ? haversineDistanceKm(geometry[0], point) : 0),
          elevation: profilePoint?.elev ?? 0,
          lat: point[0],
          lng: point[1],
        }
      })

      setRouteGeometry(geometry)
      setRoutePlannerStats({
        distanceKm,
        durationSec: (distanceKm / 15) * 3600,
        maxElevation,
        elevationProfile,
        elevationData,
        geometry,
      })
    } catch (err) {
      setRouteError('Failed to calculate route. Please adjust waypoint coordinates and try again.')
      setRouteGeometry([])
      setRoutePlannerStats(null)
    } finally {
      setRouteLoading(false)
    }
  }, [avoidHikingTrails, fetchElevationProfile, getBrouterProfile, roadPreference])

  useEffect(() => {
    calculateRouteFromWaypoints(waypointCoordinates)
  }, [calculateRouteFromWaypoints, waypointCoordinates])

  const handleSaveRoute = useCallback(async () => {
    if (!routePlannerStats) {
      alert('Please provide at least two valid waypoint coordinates first.')
      return
    }

    const routeName = `Custom Track ${new Date().toLocaleDateString()}`
    const coordinates = routePlannerStats.geometry.map(([lat, lng]) => ({ lat, lng }))
    const distanceKm = Number(routePlannerStats.distanceKm.toFixed(1))

    const { data, error } = await supabase.rpc('save_or_increment_route', {
      route_name: routeName,
      route_coordinates: coordinates,
      distance_km: distanceKm,
      estimated_time_sec: Math.round(routePlannerStats.durationSec),
      max_elevation_m: routePlannerStats.maxElevation,
      road_preference: roadPreference,
      route_difficulty: routeDifficulty,
      avoid_hiking_trails: avoidHikingTrails,
    })

    if (error) {
      alert('Unable to save: ' + error.message)
      return
    }

    alert(data?.message || 'Route saved successfully!')
  }, [avoidHikingTrails, roadPreference, routeDifficulty, routePlannerStats])

  const handleCommunityRouteSelect = useCallback((route) => {
    const positions = Array.isArray(route.coordinates)
      ? route.coordinates.map((point) => [point.lat, point.lng])
      : []
    setSelectedCommunityRoute(route)
    setCommunityRoutePositions(positions)
    // This is only reachable from the User Routes tab's "Show on Map"/"Navigate"
    // actions, so make sure that tab is what's showing (and stays showing) —
    // and actually move the camera, otherwise "Show on Map" looks like a no-op
    // unless the route happens to already be in view.
    setPlannerTab('userRoutes')

    const bounds = computeBoundsFromLatLngs(positions)
    if (bounds) {
      getMapInstance()?.fitBounds(bounds, { padding: 50, duration: 1200 })
    }
  }, [getMapInstance])

  const handleStatsUpdate = useCallback((filename, stats) => {
    setTrailStats((prev) => ({ ...prev, [filename]: stats }))
  }, [])

  const handleChartHover = useCallback((point) => {
    setHoverPosition(point)
  }, [])

  const handleCalculateRoute = useCallback(() => {
    calculateRouteFromWaypoints(waypointCoordinates)
  }, [calculateRouteFromWaypoints, waypointCoordinates])

  const handleBackToRoutes = useCallback(() => {
    setSelectedTrail(null)
    setSelectedCommunityRoute(null)
    setCommunityRoutePositions([])
    setSelectedTrailCommunityData(null)
    setHoverPosition(null)
  }, [])

  const enterNavigationMode = useCallback((pathEntry) => {
    setActiveNavigationPath(pathEntry)
    setCollapseRequestToken((token) => (token == null ? 1 : token + 1))
    setNavigationModeActive(true)
    setAutoFollowPaused(false)
    nav.start(pathEntry)
    // One-time reset to north on entry — bearing is left uncontrolled for the
    // rest of the session (see the <Map> bearing prop below) so manual
    // drag/pinch rotation works normally instead of snapping back every frame.
    getMapInstance()?.easeTo({ bearing: 0, duration: 400 })

    // Auto-start ride recording for the duration of the navigation session.
    setActiveRecording(true)
    setGpsTrackPoints([])
    setRideStartTime(Date.now())
  }, [nav, getMapInstance])

  const exitNavigationMode = useCallback(() => {
    setActiveRecording(false)

    if (rideStartTime && gpsTrackPoints.length > 1) {
      const stats = computeRideStats(gpsTrackPoints, rideStartTime)
      setCompletedRideStats({
        ...stats,
        trackPoints: gpsTrackPoints,
        navigationSource: activeNavigationPath?.source,
        navigationName: activeNavigationPath?.name,
        trailFilename: activeNavigationPath?.source === 'gpx' ? selectedTrail : null,
      })
      setShowRideSummary(true)
    }

    nav.stop()
    setNavigationModeActive(false)
    setActiveNavigationPath(null)
    setPendingNavTarget(null)
    setAutoFollowPaused(false)
  }, [nav, rideStartTime, gpsTrackPoints, activeNavigationPath, selectedTrail])

  // Detects genuine user gestures (drag/pinch) vs our own programmatic camera
  // moves — MapLibre only sets `originalEvent` for the former — and pauses
  // camera auto-follow so it doesn't fight the rider's manual pan.
  const handleUserMapInteractionStart = useCallback((event) => {
    handleMapPressEnd()
    if (navigationModeActive && event?.originalEvent) {
      setAutoFollowPaused(true)
    }
  }, [navigationModeActive, handleMapPressEnd])

  const handleRecenter = useCallback(() => {
    setAutoFollowPaused(false)
    const map = getMapInstance()
    if (map && nav.userPosition) {
      const [lat, lng] = nav.userPosition
      map.panTo([lng, lat], { duration: 500 })
    }
  }, [getMapInstance, nav.userPosition])

  const resetCompletedRideState = useCallback(() => {
    setShowRideSummary(false)
    setCompletedRideStats(null)
    setGpsTrackPoints([])
    setRideStartTime(null)
  }, [])

  const handleSaveCompletedRide = useCallback(async ({ rating, review, photoUrls, name }) => {
    const stats = completedRideStats
    if (!stats) return

    try {
      if (stats.trailFilename) {
        const routeId = selectedTrailCommunityData?.routeId

        if (routeId) {
          if (rating) {
            await supabase.from('route_reviews').insert([
              { route_id: routeId, rating, comment: review || null },
            ])
          }

          await supabase.from('completed_rides').insert([
            {
              route_id: routeId,
              distance_km: Number(stats.totalDistance.toFixed(2)),
              duration_sec: stats.movingTime,
              elevation_gain: Math.round(stats.elevationGain),
              track_points: stats.trackPoints,
            },
          ])

          if (photoUrls && photoUrls.length > 0) {
            await supabase.from('ride_photos').insert([
              { route_id: routeId, photo_urls: photoUrls, created_at: new Date().toISOString() },
            ])
          }
        }

        alert('Experience saved to this trail! 🎉')
      } else {
        // "Custom Route" is the placeholder name assigned when a planned route
        // enters navigation — not worth falling back to; prefer whatever the
        // rider typed in the modal, then a real navigationName, then a dated default.
        const trimmedName = name && name.trim()
        const fallbackName = stats.navigationName && stats.navigationName !== 'Custom Route' ? stats.navigationName : null
        const routeName = trimmedName || fallbackName || `My Ride ${new Date().toLocaleDateString()}`

        const { data: insertedRoute, error: insertError } = await supabase
          .from('user_routes')
          .insert([
            {
              name: routeName,
              coordinates: stats.trackPoints.map((point) => ({ lat: point.lat, lng: point.lng })),
              distance_km: Number(stats.totalDistance.toFixed(2)),
            },
          ])
          .select('id')
          .single()

        if (insertError) throw insertError

        if (rating && insertedRoute?.id) {
          const { error: reviewError } = await supabase
            .from('route_reviews')
            .insert([{ route_id: insertedRoute.id, rating, comment: review || null }])
          if (reviewError) console.error('Review insert failed:', reviewError)
        }

        if (photoUrls && photoUrls.length > 0 && insertedRoute?.id) {
          const { error: photoError } = await supabase
            .from('ride_photos')
            .insert([{ route_id: insertedRoute.id, photo_urls: photoUrls }])
          if (photoError) console.error('Photo insert failed:', photoError)
        }

        alert('Ride saved! 🎉')
      }
    } catch (err) {
      alert('Could not save ride: ' + err.message)
    }

    resetCompletedRideState()
  }, [completedRideStats, selectedTrailCommunityData, resetCompletedRideState])

  const handleNavigateClick = useCallback((payload, source) => {
    if (source === 'gpx') {
      const trail = payload
      setSelectedTrail(trail.filename)
      const existingRawPath = trailStats[trail.filename]?.rawPath
      if (existingRawPath && existingRawPath.length >= 2) {
        enterNavigationMode({ source: 'gpx', name: trail.name, points: existingRawPath })
      } else {
        setPendingNavTarget(trail.filename)
      }
      return
    }

    if (source === 'community') {
      const route = payload
      handleCommunityRouteSelect(route)
      const points = Array.isArray(route.coordinates)
        ? route.coordinates.map((point) => [point.lat, point.lng])
        : []
      if (points.length >= 2) {
        enterNavigationMode({ source: 'community', name: route.name, points })
      }
      return
    }

    if (source === 'planned') {
      enterNavigationMode(payload)
    }
  }, [enterNavigationMode, handleCommunityRouteSelect, trailStats])

  // Single entry point for the floating deck's Start Ride button. If a trail
  // is currently selected (GPX, a shown user route, or a planned/waypoint
  // route), starts turn-by-turn navigation for it — which auto-starts
  // recording too (see enterNavigationMode). Otherwise starts a plain GPS
  // recording with no route/turn-by-turn guidance.
  const handleStartRide = useCallback(() => {
    if (selectedTrail) {
      const trail = trails.find((item) => item.filename === selectedTrail)
      if (trail) {
        handleNavigateClick(trail, 'gpx')
        return
      }
    }

    if (plannerTab === 'planNew' && routePlannerStats?.geometry?.length >= 2) {
      handleNavigateClick({ source: 'planned', name: 'Custom Route', points: routePlannerStats.geometry }, 'planned')
      return
    }

    if (selectedCommunityRoute) {
      handleNavigateClick(selectedCommunityRoute, 'community')
      return
    }

    // No route context — just record GPS without turn-by-turn navigation.
    setActiveRecording(true)
    setGpsTrackPoints([])
    setRideStartTime(Date.now())
  }, [selectedTrail, trails, plannerTab, routePlannerStats, selectedCommunityRoute, handleNavigateClick])

  const handleStartRideButtonClick = useCallback(() => {
    if (activeRecording) {
      exitNavigationMode()
      return
    }
    handleStartRide()
  }, [activeRecording, exitNavigationMode, handleStartRide])

  // Native `title` tooltips don't fire on touch devices, so the Start/Stop
  // Ride button gets its own hover (desktop) + long-press (mobile) tooltip.
  const [showRideTooltip, setShowRideTooltip] = useState(false)
  const rideButtonLongPressTimerRef = useRef(null)

  const handleRideButtonTouchStart = useCallback(() => {
    rideButtonLongPressTimerRef.current = window.setTimeout(() => setShowRideTooltip(true), 500)
  }, [])

  const handleRideButtonTouchEnd = useCallback(() => {
    if (rideButtonLongPressTimerRef.current != null) {
      clearTimeout(rideButtonLongPressTimerRef.current)
      rideButtonLongPressTimerRef.current = null
    }
    setShowRideTooltip(false)
  }, [])

  // GPX trails' full-resolution path only becomes available once GpxTrails
  // finishes loading the file. If Navigate was clicked on a trail that
  // hasn't been shown/loaded yet, wait here until its rawPath appears.
  useEffect(() => {
    if (!pendingNavTarget) return
    const rawPath = trailStats[pendingNavTarget]?.rawPath
    if (rawPath && rawPath.length >= 2) {
      const trail = trails.find((item) => item.filename === pendingNavTarget)
      enterNavigationMode({ source: 'gpx', name: trail?.name || pendingNavTarget, points: rawPath })
      setPendingNavTarget(null)
    }
  }, [pendingNavTarget, trailStats, trails, enterNavigationMode])

  // Construct UI for the Custom Planner Panel
  const planNewContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 0' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 'bold', margin: '0' }}>Plan a Custom Trail</h3>
      
      {waypoints.map((waypoint, idx) => {
        const isPinning = activePinningIndex === idx
        return (
          <div
            key={waypoint.id}
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              padding: '8px',
              borderRadius: '12px',
              border: isPinning ? '1px solid rgba(167, 139, 250, 0.9)' : '1px solid rgba(148, 163, 184, 0.22)',
              background: isPinning ? 'rgba(88, 28, 135, 0.14)' : 'rgba(15, 23, 42, 0.4)',
            }}
          >
            <input
              type="text"
              placeholder={`Waypoint ${idx + 1} address`}
              value={waypoint.address}
              onChange={(e) => handleWaypointAddressChange(idx, e.target.value)}
              onKeyDown={(e) => handleWaypointSearchKeyDown(idx, e)}
              style={{
                flex: 1,
                minWidth: 0,
                height: '40px',
                padding: '0 12px',
                borderRadius: '10px',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                fontSize: '0.9rem',
              }}
            />
            <button
              type="button"
              onClick={() => handleWaypointSearchClick(idx)}
              disabled={waypointSearchLoadingIndex === idx}
              title="Search address"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                border: 'none',
                background: '#4c1d95',
                color: '#f8fafc',
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(0,0,0,0.18)',
              }}
            >
              {waypointSearchLoadingIndex === idx ? '…' : '⌕'}
            </button>
            <button
              type="button"
              onClick={() => handleWaypointPinClick(idx)}
              title={isPinning ? 'Click the map to place this waypoint' : 'Choose on map'}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                border: 'none',
                background: isPinning ? '#a855f7' : '#6d28d9',
                color: '#f8fafc',
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(0,0,0,0.18)',
              }}
            >
              📍
            </button>
          </div>
        )
      })}

      {activePinningIndex != null && (
        <div style={{
          fontSize: '0.8rem',
          color: '#c4b5fd',
          background: 'rgba(88, 28, 135, 0.14)',
          border: '1px dashed rgba(167, 139, 250, 0.5)',
          borderRadius: '10px',
          padding: '8px 10px',
        }}>
          Tap the map to place Waypoint {activePinningIndex + 1}.
        </div>
      )}

      <button
        type="button"
        onClick={handleAddWaypoint}
        style={{
          background: '#4c1d95',
          color: '#ffffff',
          border: 'none',
          padding: '10px 12px',
          borderRadius: '10px',
          fontWeight: 'bold',
          cursor: 'pointer',
          height: '40px',
        }}
      >
        Add Waypoint
      </button>

      <div style={{ display: 'flex', gap: '8px' }}>
        <select 
          value={roadPreference} 
          onChange={(e) => setRoadPreference(e.target.value)}
          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }}
        >
      <option value="gravel">Gravel Preferred</option>
<option value="paved">Asphalt Only</option>
<option value="mixed">Mixed (Best Route)</option>
<option value="bike_tracks">Local Bike Tracks</option>
        </select>

        <select 
          value={routeDifficulty} 
          onChange={(e) => setRouteDifficulty(e.target.value)}
          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }}
        >
          <option value="easy">Easy (Flat)</option>
          <option value="moderate">Moderate</option>
          <option value="expert">Expert (Steep)</option>
        </select>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
        <input 
          type="checkbox" 
          checked={avoidHikingTrails} 
          onChange={(e) => setAvoidHikingTrails(e.target.checked)} 
        />
        Avoid extreme hiking trails
      </label>

      {routeError && <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>{routeError}</span>}

      <button
        onClick={handleCalculateRoute}
        disabled={routeLoading}
        style={{
          background: '#370063',
          color: '#ffffff',
          border: 'none',
          padding: '10px 12px',
          borderRadius: '10px',
          fontWeight: 'bold',
          cursor: 'pointer',
          height: '40px',
          opacity: routeLoading ? 0.7 : 1
        }}
      >
        {routeLoading ? 'Calculating Route...' : 'Generate Custom Route'}
      </button>

      {routePlannerStats && (
        <div style={{
          marginTop: '8px',
          padding: '12px',
          backgroundColor: '#370063',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          color: '#ffffff',
        }}>
          <div className="details-header" style={{ marginBottom: '10px' }}>
            <h3 style={{ margin: 0 }}>Custom Route Summary</h3>
            <span
              className="details-difficulty-badge"
              style={{ backgroundColor: '#a78bfa', color: '#1f0931' }}
            >
              Plan New
            </span>
          </div>

          <div className="stats-grid" style={{ marginBottom: '10px', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <div className="stat-item" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <span className="stat-label" style={{ color: '#b794f4' }}>Distance</span>
              <span className="stat-value">{routePlannerStats.distanceKm.toFixed(2)} km</span>
            </div>
            <div className="stat-item" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <span className="stat-label" style={{ color: '#b794f4' }}>Estimated Time</span>
              <span className="stat-value">{(routePlannerStats.durationSec / 3600).toFixed(2)} h</span>
            </div>
            <div className="stat-item" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <span className="stat-label" style={{ color: '#b794f4' }}>Max Elevation</span>
              <span className="stat-value">{routePlannerStats.maxElevation != null ? `${Math.round(routePlannerStats.maxElevation)} m` : 'N/A'}</span>
            </div>
          </div>
          <RouteElevationChart data={routePlannerStats.elevationData} chartColor="#a78bfa" onHover={handleChartHover} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              onClick={handleSaveRoute}
              style={{
                background: '#10b981',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Save Route to Account
            </button>
            <button
              onClick={() => handleNavigateClick(
                { source: 'planned', name: 'Custom Route', points: routePlannerStats.geometry },
                'planned'
              )}
              style={{
                background: '#0ea5e9',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Navigate
            </button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="app-container">
      <div className="main-content">
        <div className="map-wrapper" style={{ position: 'relative', overflow: navigationModeActive ? 'hidden' : 'visible' }}>

          {/* FLOATING CONTROL DECK - stays visible during navigation so the rider can
              still change layers, drop into 3D, or reach Stop & Save (the unified
              Start Ride / Stop & Save button doubles as the old Stop Navigation button). */}
          <div className="map-floating-actions" style={{
            position: 'absolute',
            top: '75px',
            right: '16px',
            zIndex: 1600,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center'
          }}>
            {navigationModeActive && autoFollowPaused && (
              <button
                onClick={handleRecenter}
                title="Recenter"
                style={iconButtonStyle}
              >
                <img src="/locate-me.svg" alt="" style={{ width: '22px', height: '22px' }} />
              </button>
            )}

            <button
              onClick={handleToggleLayerMenu}
              title="Change Base Map"
              style={{ ...iconButtonStyle, backgroundColor: showLayerMenu ? '#b794f4' : '#370063' }}
            >
              <img src="/layers.svg" alt="" style={{ width: '22px', height: '22px' }} />
            </button>

            <button
              onClick={handleDownloadMap}
              title="Download Map for Offline Use"
              disabled={mapDownload.status === 'downloading'}
              style={{
                ...iconButtonStyle,
                backgroundColor: mapDownload.status === 'complete' ? '#16a34a' : '#370063',
                fontSize: '1.2rem',
                cursor: mapDownload.status === 'downloading' ? 'default' : 'pointer',
              }}
            >
              {mapDownload.status === 'complete' ? '✅' : '⬇️'}
            </button>

            <button
              onClick={handleToggle3D}
              title={is3D ? 'Switch to 2D View' : 'Switch to 3D View'}
              style={{
                ...iconButtonStyle,
                backgroundColor: is3D ? '#a78bfa' : '#370063',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                color: '#ffffff',
              }}
            >
              3D
            </button>

            <button
              onClick={handleTogglePoiMenu}
              title="Toggle POIs"
              style={{ ...iconButtonStyle, backgroundColor: showPoiMenu ? '#b794f4' : '#370063' }}
            >
              <img src="/pin-poi.svg" alt="" style={{ width: '22px', height: '22px' }} />
            </button>

            <div style={{ position: 'relative' }}>
              <button
                onClick={handleStartRideButtonClick}
                onMouseEnter={() => setShowRideTooltip(true)}
                onMouseLeave={() => setShowRideTooltip(false)}
                onTouchStart={handleRideButtonTouchStart}
                onTouchEnd={handleRideButtonTouchEnd}
                onTouchCancel={handleRideButtonTouchEnd}
                title={activeRecording ? 'Stop & Save' : 'Start Ride'}
                aria-label={activeRecording ? 'Stop & Save' : 'Start Ride'}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: activeRecording ? '#f97316' : '#753cae',
                  boxShadow: '0 4px 20px rgba(117, 60, 174, 0.4)',
                  position: 'relative',
                  zIndex: 1200,
                  transition: 'background-color 0.2s ease',
                }}
              >
                {activeRecording ? (
                  <img src="/stop-icon.svg" alt="Stop Ride" style={{ width: 28, height: 28, filter: 'brightness(0) invert(1)' }} />
                ) : (
                  <img src="/start-icon.svg" alt="Start Ride" style={{ width: 28, height: 28, filter: 'brightness(0) invert(1)' }} />
                )}
              </button>

              {showRideTooltip && (
                <div style={{
                  position: 'absolute',
                  right: '64px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#1f0931',
                  color: '#ffffff',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                  pointerEvents: 'none',
                }}>
                  {activeRecording ? 'Stop & Save' : 'Start Ride'}
                </div>
              )}
            </div>

            <button
              onClick={handleLocateMe}
              title="Locate Me"
              style={iconButtonStyle}
            >
              <img src="/locate-me.svg" alt="" style={{ width: '22px', height: '22px' }} />
            </button>

            <button
              onClick={handleReportProblem}
              title="Report a Problem"
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#753cae',
                boxShadow: '0 4px 20px rgba(117, 60, 174, 0.4)',
              }}
            >
              <img src="/report-problem.svg" alt="" style={{ width: '28px', height: '28px' }} />
            </button>
          </div>

          {/* BASE MAP SELECTOR - Vector / OpenStreetMap / Satellite */}
          {showLayerMenu && (
            <div style={{
              position: 'absolute',
              top: '75px',
              right: '72px',
              zIndex: 1600,
              backgroundColor: '#370063',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '10px 12px',
              minWidth: '180px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#b794f4', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Base Map
              </span>
              {BASE_MAP_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleSelectBaseMap(option.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    textAlign: 'left',
                    cursor: 'pointer',
                    backgroundColor: mapStyle === option.id ? '#a78bfa' : '#1a1424',
                    color: mapStyle === option.id ? '#1f0931' : '#e2e8f0',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {/* OFFLINE MAP DOWNLOAD PROGRESS */}
          {mapDownload.status !== 'idle' && (
            <div style={{
              position: 'absolute',
              top: '132px',
              right: '72px',
              zIndex: 1600,
              backgroundColor: '#370063',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '12px 14px',
              minWidth: '220px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              color: '#ffffff',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#b794f4', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Offline Map
                </span>
                {mapDownload.status !== 'downloading' && (
                  <button
                    type="button"
                    onClick={() => setMapDownload({ status: 'idle', downloaded: 0, failed: 0, total: 0 })}
                    style={{ background: 'transparent', border: 'none', color: '#b794f4', cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1 }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {mapDownload.status === 'downloading' && (
                <>
                  <div style={{ fontSize: '0.85rem' }}>
                    {mapDownload.total > 0
                      ? `Downloading ${mapDownload.downloaded + mapDownload.failed} / ${mapDownload.total} tiles...`
                      : 'Preparing download...'}
                    {mapDownload.failed > 0 && ` (${mapDownload.failed} failed)`}
                  </div>
                  <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: mapDownload.total > 0 ? `${((mapDownload.downloaded + mapDownload.failed) / mapDownload.total) * 100}%` : '4%',
                        background: '#a78bfa',
                        transition: 'width 0.2s ease',
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelDownloadMap}
                    style={{
                      alignSelf: 'flex-start',
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.3)',
                      color: '#ffffff',
                      borderRadius: '8px',
                      padding: '4px 10px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}

              {mapDownload.status === 'complete' && (
                <div style={{ fontSize: '0.85rem' }}>
                  Brač map ready for offline use! {mapDownload.downloaded} tiles cached
                  {mapDownload.failed > 0 ? `, ${mapDownload.failed} failed.` : '.'}
                </div>
              )}

              {mapDownload.status === 'error' && (
                <div style={{ fontSize: '0.85rem', color: '#fca5a5' }}>
                  {mapDownload.message || 'Could not download the offline map.'}
                </div>
              )}
            </div>
          )}

          {/* CATEGORY FILTER PILL CARD - Displayed dynamically over map */}
          {showPoiMenu && (
            <div style={{
              position: 'absolute',
              top: '75px',
              right: '72px',
              zIndex: 1600,
              backgroundColor: '#370063',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '10px 12px',
              maxWidth: '240px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#b794f4', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Filter Places
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {availableCategories.map((cat) => {
                  const meta = POI_METADATA[cat] || { label: cat.toUpperCase(), color: '#8b5cf6' }
                  const isActive = selectedCategories.includes(cat)
                  return (
                    <button
                      key={cat}
                      onClick={() => handleToggleCategory(cat)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '16px',
                        border: 'none',
                        fontSize: '0.7rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        backgroundColor: isActive ? meta.color : '#1a1424',
                        color: isActive ? '#ffffff' : '#a0aec0',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {meta.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {isDropPinMode && (
            <div style={{
              position: 'absolute',
              top: '130px',
              right: '16px',
              zIndex: 1001,
              backgroundColor: '#370063',
              color: '#f7fafc',
              padding: '8px 10px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.2)',
              fontSize: '0.75rem',
              maxWidth: '220px',
            }}>
              Tap anywhere on the map to drop a hazard pin.
            </div>
          )}

          {/* Bearing is only controlled outside navigation (for the 3D tilt angle).
              During navigation it's left out of props entirely — binding it to the
              compass caused visible camera wobble from noisy orientation readings,
              and controlling it to a fixed value would fight/undo manual
              drag-to-rotate gestures. It's reset to north once on entry, in
              enterNavigationMode. */}
          <div className="map-container">
            <Map
              ref={mapRef}
              mapLib={maplibregl}
              initialViewState={{ longitude: BRAC_CENTER.longitude, latitude: BRAC_CENTER.latitude, zoom: 11 }}
              maxBounds={BRAC_BOUNDS}
              minZoom={BRAC_MIN_ZOOM}
              maxZoom={BRAC_MAX_ZOOM}
              style={{ width: '100%', height: '100%' }}
              mapStyle={BASE_MAP_STYLES[mapStyle] || BASE_MAP_STYLES.maptiler}
              onClick={handleMapClick}
              onMouseDown={handleMapPressStart}
              onMouseUp={handleMapPressEnd}
              onTouchStart={handleMapPressStart}
              onTouchEnd={handleMapPressEnd}
              onDragStart={handleUserMapInteractionStart}
              onMoveStart={handleUserMapInteractionStart}
              onZoomStart={handleUserMapInteractionStart}
              onError={(event) => {
                console.error(`MapTiler failed to load a map resource (style: ${mapStyle}):`, event?.error || event)
              }}
              onLoad={handleMapLoad}
              onStyleData={handleMapLoad}
              {...(navigationModeActive ? {} : { bearing: is3D ? -15 : 0 })}
              pitch={navigationModeActive ? 0 : (is3D ? 60 : 0)}
            >
              {plannerTab !== 'planNew' && !selectedCommunityRoute && selectedTrailPath.length > 1 && (
                <Source id="gpx-selected-route" type="geojson" data={toLineFeature(selectedTrailPath)}>
                  <Layer
                    id="gpx-selected-route-line"
                    {...LINE_LAYER_BASE}
                    paint={{
                      ...LINE_LAYER_BASE.paint,
                      'line-width': 3,
                      'line-color': GPX_DIFFICULTY_COLORS[selectedTrailMeta?.difficulty] || GPX_DIFFICULTY_COLORS.easy,
                    }}
                  />
                </Source>
              )}

              {plannerTab !== 'planNew' && selectedCommunityRoute && communityRoutePositions.length > 0 && (
                <Source id="community-route" type="geojson" data={toLineFeature(communityRoutePositions)}>
                  <Layer id="community-route-line" {...LINE_LAYER_BASE} paint={{ ...LINE_LAYER_BASE.paint, 'line-color': '#a78bfa' }} />
                </Source>
              )}

              {plannerTab === 'planNew' && routeGeometry.length > 0 && (
                <Source id="planned-route" type="geojson" data={toLineFeature(routeGeometry)}>
                  <Layer id="planned-route-line" {...LINE_LAYER_BASE} paint={{ ...LINE_LAYER_BASE.paint, 'line-color': '#00e676' }} />
                </Source>
              )}

              {gpsTrackPoints.length > 1 && (
                <Source id="gps-track" type="geojson" data={toLineFeature(gpsTrackPoints.map((point) => [point.lat, point.lng]))}>
                  <Layer id="gps-track-line" {...LINE_LAYER_BASE} paint={{ ...LINE_LAYER_BASE.paint, 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.85 }} />
                </Source>
              )}

              {navigationModeActive && remainingPath.length > 1 && (
                <Source id="navigation-path" type="geojson" data={toLineFeature(remainingPath)}>
                  <Layer id="navigation-path-line" {...LINE_LAYER_BASE} paint={{ ...LINE_LAYER_BASE.paint, 'line-color': '#22d3ee', 'line-width': 5 }} />
                </Source>
              )}

              {hoverPosition && hoverPosition.lat != null && hoverPosition.lng != null && (
                <Source id="hover-point" type="geojson" data={toPointFeature(hoverPosition.lat, hoverPosition.lng)}>
                  <Layer
                    id="hover-point-circle"
                    type="circle"
                    paint={{
                      'circle-radius': 8,
                      'circle-color': '#4ade80',
                      'circle-stroke-width': 2,
                      'circle-stroke-color': '#ffffff',
                    }}
                  />
                </Source>
              )}

              {gpsPosition && (
                <>
                  <Source id="gps-position" type="geojson" data={toPointFeature(gpsPosition.lat, gpsPosition.lng)}>
                    <Layer
                      id="gps-position-circle"
                      type="circle"
                      paint={{
                        'circle-radius': 8,
                        'circle-color': '#3b82f6',
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#3b82f6',
                      }}
                    />
                  </Source>
                  {Number.isFinite(gpsPosition.accuracy) && (
                    <Source id="gps-accuracy" type="geojson" data={toPointFeature(gpsPosition.lat, gpsPosition.lng)}>
                      <Layer
                        id="gps-accuracy-circle"
                        type="circle"
                        paint={{
                          'circle-radius': Math.max(10, gpsPosition.accuracy / 3),
                          'circle-color': '#3b82f6',
                          'circle-opacity': 0.12,
                        }}
                      />
                    </Source>
                  )}
                </>
              )}

              {navigationModeActive && nav.userPosition && (
                <Marker longitude={nav.userPosition[1]} latitude={nav.userPosition[0]} anchor="center">
                  {/* Map bearing is no longer slaved to the compass (see enterNavigationMode),
                      so the arrow's rotation is just the rider's absolute heading. */}
                  <div style={{ transform: `rotate(${nav.userHeadingDeg ?? 0}deg)` }}>
                    <div style={{ width: 0, height: 0, borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderBottom: '20px solid #0ea5e9', filter: 'drop-shadow(0 2px 3px rgba(2,6,23,0.5))' }} />
                  </div>
                </Marker>
              )}

              {reports.map((report) => (
                <Marker key={report.id} longitude={report.lng} latitude={report.lat} anchor="center">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedReportId(report.id)
                    }}
                    style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}
                  >
                    ⚠️
                  </button>
                </Marker>
              ))}

              {selectedReportId != null && (() => {
                const report = reports.find((item) => item.id === selectedReportId)
                if (!report) return null
                return (
                  <Popup
                    longitude={report.lng}
                    latitude={report.lat}
                    anchor="top"
                    closeOnClick={false}
                    onClose={() => setSelectedReportId(null)}
                  >
                    <div style={{ minWidth: 160 }}>
                      <strong>{report.type}</strong>
                      {report.description ? <div style={{ marginTop: 6 }}>{report.description}</div> : null}
                      <div style={{ marginTop: 8, color: '#94a3b8' }}>{timeAgo(report.created_at)}</div>
                    </div>
                  </Popup>
                )
              })()}

              {plannerTab === 'planNew' && waypoints.map((waypoint, index) => (
                waypoint.latlng ? (
                  <Marker
                    key={waypoint.id}
                    longitude={waypoint.latlng[1]}
                    latitude={waypoint.latlng[0]}
                    draggable
                    onDragEnd={(event) => {
                      updateWaypointLatLng(index, event.lngLat.lat, event.lngLat.lng)
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        border: 'none',
                        borderRadius: '999px',
                        background: '#f8fafc',
                        color: '#1f2937',
                        width: 26,
                        height: 26,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'grab',
                      }}
                    >
                      {index + 1}
                    </button>
                  </Marker>
                ) : null
              ))}

              {filteredPois.map((poi) => {
                const pinColor = POI_METADATA[poi.category]?.color || '#8b5cf6'
                return (
                  <Marker key={poi.id} longitude={poi.coordinates.lng} latitude={poi.coordinates.lat} anchor="bottom">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedPoiId(poi.id)
                      }}
                      title={poi.name}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        lineHeight: 0,
                        cursor: 'pointer',
                      }}
                    >
                      <svg
                        width="24"
                        height="32"
                        viewBox="0 0 24 32"
                        style={{ display: 'block', filter: 'drop-shadow(0 2px 3px rgba(15,23,42,0.45))' }}
                      >
                        <path
                          d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20C24 5.373 18.627 0 12 0z"
                          fill={pinColor}
                        />
                        <circle cx="12" cy="12" r="4.5" fill="#ffffff" />
                      </svg>
                    </button>
                  </Marker>
                )
              })}

              {selectedPoiId != null && (() => {
                const poi = filteredPois.find((item) => item.id === selectedPoiId)
                if (!poi) return null
                return (
                  <Popup
                    longitude={poi.coordinates.lng}
                    latitude={poi.coordinates.lat}
                    anchor="top"
                    closeOnClick={false}
                    onClose={() => setSelectedPoiId(null)}
                  >
                    <div style={{ minWidth: '160px', color: '#333', fontFamily: 'sans-serif' }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '14px' }}>{poi.name}</h4>
                      <span style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>
                        {poi.category.replace('_', ' ')}
                      </span>
                    </div>
                  </Popup>
                )
              })()}

              {hoverPosition && hoverPosition.lat != null && hoverPosition.lng != null && (
                <Popup
                  longitude={hoverPosition.lng}
                  latitude={hoverPosition.lat}
                  anchor="top"
                  closeButton={false}
                  closeOnClick={false}
                >
                  <div style={{ color: '#0f172a', fontWeight: 700 }}>
                    {hoverPosition.distance != null ? `${hoverPosition.distance.toFixed(1)} km` : ''}
                    {hoverPosition.elevation != null ? ` · ${Math.round(hoverPosition.elevation)} m` : ''}
                  </div>
                </Popup>
              )}
            </Map>

            <ReportProblem
              ref={reportProblemRef}
              initialCoordinates={reportCoordinates}
              onRequestDropPin={handleDropPinRequest}
              onReportSaved={() => setReportsRefreshKey((k) => k + 1)}
            />
          </div>

          {navigationModeActive && (
            <NavigationHud
              loading={nav.loading}
              distanceRemainingKm={nav.distanceRemainingKm}
              progressFraction={nav.progressFraction}
              relativeBearingDeg={nav.relativeBearingDeg}
              activeHazardWarning={nav.activeHazardWarning}
              onDismissHazardWarning={nav.dismissHazardWarning}
              mapRotationDeg={nav.mapRotationDeg}
              isNorthUpLocked={nav.isNorthUpLocked}
              onToggleNorthUpLock={nav.toggleNorthUpLock}
              onExit={exitNavigationMode}
              routeName={activeNavigationPath?.name}
            />
          )}
        </div>

        {/* Bottom Drawer Section */}
        <BottomSheet
          trails={trails}
          selectedTrail={selectedTrail}
          trailStats={trailStats}
          onTrailClick={handleTrailClick}
          onBackToRoutes={handleBackToRoutes}
          onChartHover={handleChartHover}
          activeTab={plannerTab}
          onTabChange={setPlannerTab}
          onRouteSelect={handleCommunityRouteSelect}
          onNavigateClick={handleNavigateClick}
          selectedRouteId={selectedCommunityRoute?.id}
          routeFeedbackRefreshKey={routeFeedbackRefreshKey}
          trailCommunityData={selectedTrailCommunityData}
          planNewContent={planNewContent}
          collapseRequestToken={collapseRequestToken}
        />

        {showRideSummary && completedRideStats && (
          <RideSummaryModal
            isOpen={showRideSummary}
            stats={completedRideStats}
            onSave={handleSaveCompletedRide}
            onDiscard={resetCompletedRideState}
          />
        )}
      </div>
    </div>
  )
}