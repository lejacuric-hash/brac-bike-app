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
  const [mapStyle, setMapStyle] = useState('street') 
  
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

  useEffect(() => {
    if (!activeRecording) return undefined

    const interval = window.setInterval(() => {
      setGpsTrackPoints((prev) => {
        if (!gpsPosition) return prev
        return [
          ...prev,
          {
            lat: gpsPosition.lat,
            lng: gpsPosition.lng,
            altitude: gpsPosition.altitude,
            timestamp: gpsPosition.timestamp,
          },
        ]
      })
    }, 3000)

    return () => {
      clearInterval(interval)
    }
  }, [activeRecording, gpsPosition])

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

  useEffect(() => {
    const map = getMapInstance()
    if (!map) return

    const handlers = ['dragPan', 'scrollZoom', 'doubleClickZoom', 'touchZoomRotate', 'keyboard', 'boxZoom']
    if (navigationModeActive) {
      handlers.forEach((name) => {
        if (map[name]?.disable) map[name].disable()
      })
    } else {
      handlers.forEach((name) => {
        if (map[name]?.enable) map[name].enable()
      })
    }
  }, [getMapInstance, navigationModeActive])

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
    if (nextState) {
      setSelectedCategories([])
    }
  }

  const handleStartRecording = useCallback(() => {
    setActiveRecording((prev) => {
      const next = !prev
      if (next) {
        setGpsTrackPoints([])
      }
      return next
    })
  }, [])

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

        geometry = routeGeometryCoords.map((point) => [point[1], point[0]])

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
  }, [])

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
    nav.start(pathEntry)
  }, [nav])

  const exitNavigationMode = useCallback(() => {
    nav.stop()
    setNavigationModeActive(false)
    setActiveNavigationPath(null)
    setPendingNavTarget(null)
  }, [nav])

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
          <option value="gravel">Gravel Track Preferred</option>
          <option value="paved">Asphalt/Paved Only</option>
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

          {/* FLOATING CONTROL DECK - PURE ICONS ONLY */}
          {!navigationModeActive && (
          <div className="map-floating-actions" style={{
            position: 'absolute',
            top: '75px',
            right: '16px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center'
          }}>
            <button
              onClick={() => setMapStyle(mapStyle === 'street' ? 'satellite' : 'street')}
              title="Toggle Map Layers"
              style={iconButtonStyle}
            >
              <img src="/layers.svg" alt="" style={{ width: '22px', height: '22px' }} />
            </button>

            <button
              onClick={handleTogglePoiMenu}
              title="Toggle POIs"
              style={{ ...iconButtonStyle, backgroundColor: showPoiMenu ? '#b794f4' : '#370063' }}
            >
              <img src="/pin-poi.svg" alt="" style={{ width: '22px', height: '22px' }} />
            </button>

            <button
              onClick={handleStartRecording}
              title={activeRecording ? 'Stop Recording' : 'Start Recording'}
              style={{
                ...iconButtonStyle,
                background: activeRecording ? '#ef6c00' : '#370063',
              }}
            >
              <img src={activeRecording ? '/stop-record.svg' : '/record.svg'} alt="" style={{ width: '22px', height: '22px' }} />
            </button>

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
              style={iconButtonStyle}
            >
              <img src="/report-problem.svg" alt="" style={{ width: '22px', height: '22px' }} />
            </button>
          </div>
          )}

          {/* CATEGORY FILTER PILL CARD - Displayed dynamically over map */}
          {!navigationModeActive && showPoiMenu && (
            <div style={{
              position: 'absolute',
              top: '75px',
              right: '72px',
              zIndex: 1000,
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

          <div className="map-container">
            <Map
              ref={mapRef}
              mapLib={maplibregl}
              initialViewState={{ longitude: 16.635, latitude: 43.307, zoom: 11 }}
              style={{ width: '100%', height: '100%' }}
              mapStyle={mapStyle === 'street' ? MAPTILER_STREET_STYLE_URL : MAPTILER_SATELLITE_STYLE_URL}
              onClick={handleMapClick}
              onMouseDown={handleMapPressStart}
              onMouseUp={handleMapPressEnd}
              onTouchStart={handleMapPressStart}
              onTouchEnd={handleMapPressEnd}
              onDragStart={handleMapPressEnd}
              onMoveStart={handleMapPressEnd}
              onZoomStart={handleMapPressEnd}
              onError={(event) => {
                console.error(`MapTiler failed to load a map resource (style: ${mapStyle}):`, event?.error || event)
              }}
              bearing={navigationModeActive ? (nav.mapRotationDeg || 0) : 0}
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

              {plannerTab === 'routes' && selectedCommunityRoute && communityRoutePositions.length > 0 && (
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
                  <div style={{ transform: `rotate(${(nav.userHeadingDeg ?? 0) - (nav.mapRotationDeg ?? 0)}deg)` }}>
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

              {filteredPois.map((poi) => (
                <Marker key={poi.id} longitude={poi.coordinates.lng} latitude={poi.coordinates.lat} anchor="bottom">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedPoiId(poi.id)
                    }}
                    style={{
                      background: '#ffffff',
                      border: '1px solid rgba(15,23,42,0.2)',
                      borderRadius: '999px',
                      width: 18,
                      height: 18,
                      cursor: 'pointer',
                    }}
                  />
                </Marker>
              ))}

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
      </div>
    </div>
  )
}