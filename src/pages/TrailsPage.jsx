import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Polyline } from 'react-leaflet'
import './TrailsPage.css'
import '../App.css'
import GpxTrails from '../components/GpxTrails'
import GpsTracker from '../components/GpsTracker'
import BottomSheet from '../components/BottomSheet'
import { RoutePlannerMap } from '../components/RoutePlanner'
import ReportMarkers from '../components/ReportMarkers'
import ReportProblem from '../components/ReportProblem'
import MapLayersOverlayMenu from '../components/MapLayersOverlayMenu'
import PlanNewView from '../components/PlanNewView'
import { BRAC_POIS } from '../data/poiData'
import { supabase } from '../supabaseClient'

const CATEGORY_MAP = {
  viewpoint: { label: '🏔 Viewpoints', color: '#FF5722' },
  beach_cove: { label: '🏖 Beaches & Coves', color: '#00BCD4' },
  geological: { label: '🪨 Geology Museum', color: '#795548' },
  archaeology: { label: '🏛 Archaeology', color: '#607D8B' },
  monastery: { label: '⛪ Churches & Chapels', color: '#E91E63' },
  military: { label: '🚢 Military History', color: '#3F51B5' },
  water: { label: '🚰 Water & Wells', color: '#2196F3' },
  gastro: { label: '🍷 Local Gastro Farms', color: '#4CAF50' },
  bike_highlight: { label: '🚴 Bike Highlights', color: '#9C27B0' },
  nature_monument: { label: '🌿 Nature Monuments', color: '#4CAF50' },
}

const LAYER_CONFIG = [
  { id: 'viewpoint', label: '🏔 Viewpoints', categories: ['viewpoint'] },
  { id: 'beach', label: '🏖 Beaches & Coves', categories: ['beach_cove'] },
  { id: 'water', label: '🚰 Water Nodes', categories: ['water'] },
  { id: 'gastro', label: '🍷 Gastro / OPGs', categories: ['gastro'] },
]

export default function TrailsPage() {
  const [trails, setTrails] = useState([])
  const [selectedTrail, setSelectedTrail] = useState(null)
  const [trailStats, setTrailStats] = useState({})
  const [hoverPosition, setHoverPosition] = useState(null)
  const [reportsRefreshKey, setReportsRefreshKey] = useState(0)
  const [plannerTab, setPlannerTab] = useState('routes')
  const [plannerMode, setPlannerMode] = useState('settingA')
  const [pointA, setPointA] = useState(null)
  const [pointB, setPointB] = useState(null)
  const [routeGeometry, setRouteGeometry] = useState([])
  const [routePlannerStats, setRoutePlannerStats] = useState(null)
  const [routeError, setRouteError] = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [selectedCommunityRoute, setSelectedCommunityRoute] = useState(null)
  const [communityRoutePositions, setCommunityRoutePositions] = useState([])
  const [activeLayers, setActiveLayers] = useState(LAYER_CONFIG.map((layer) => layer.id))
  const mapRef = useRef(null)

  const handleTrailClick = useCallback((trail) => {
    setSelectedTrail(trail.filename)
  }, [])

  const handleToggleLayer = useCallback((layerId) => {
    setActiveLayers((prev) => (prev.includes(layerId) ? prev.filter((key) => key !== layerId) : [...prev, layerId]))
  }, [])

  const filteredPois = useMemo(() => {
    return BRAC_POIS.filter((poi) => {
      const matchesLayer = LAYER_CONFIG.some((layer) => {
        if (!activeLayers.includes(layer.id)) {
          return false
        }

        return layer.categories.includes(poi.category)
      })

      return matchesLayer
    })
  }, [activeLayers])

  const handlePlannerMapClick = useCallback(
    (coords) => {
      if (plannerMode === 'settingA') {
        setPointA(coords)
        setPlannerMode('settingB')
        setRoutePlannerStats(null)
        setRouteGeometry([])
      } else {
        setPointB(coords)
        setRoutePlannerStats(null)
        setRouteGeometry([])
      }
    },
    [plannerMode]
  )

  const handleUseCurrentLocation = useCallback((coords) => {
    setPointA(coords)
    setPlannerMode('settingB')
    setRoutePlannerStats(null)
    setRouteGeometry([])
    setPlannerTab('planNew')
  }, [])

  const handleAddPointToRoute = useCallback((coords) => {
    if (!pointA) {
      setPointA(coords)
      setPlannerMode('settingB')
    } else if (!pointB) {
      setPointB(coords)
      setPlannerMode('settingA')
    } else {
      setPointA(coords)
      setPointB(null)
      setPlannerMode('settingB')
    }

    setPlannerTab('planNew')
    setRoutePlannerStats(null)
    setRouteGeometry([])
  }, [pointA, pointB])

  const handleClearPlanner = useCallback(() => {
    setPointA(null)
    setPointB(null)
    setRouteGeometry([])
    setRoutePlannerStats(null)
    setRouteError(null)
    setPlannerMode('settingA')
  }, [])

  const handleStartRide = useCallback(() => {
    alert('Starting ride tracking...')
  }, [])

  const handleSaveRoute = useCallback(async () => {
    if (!routePlannerStats || !pointA || !pointB) {
      alert('Please set both points and calculate a route before saving.')
      return
    }

    const routeName = `Route ${new Date().toLocaleString()}`
    const coordinates = routePlannerStats.geometry.map(([lat, lng]) => ({ lat, lng }))
    const distanceKm = Number(routePlannerStats.distanceKm.toFixed(3))

    const { error } = await supabase.from('user_routes').insert([
      { name: routeName, coordinates, distance_km: distanceKm },
    ])

    if (error) {
      alert('Unable to save route: ' + error.message)
      return
    }

    alert('Route saved successfully!')
  }, [pointA, pointB, routePlannerStats])

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

  useEffect(() => {
    const fetchRoute = async () => {
      if (!pointA || !pointB) return

      setRouteLoading(true)
      setRouteError(null)

      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/cycling/${pointA.lng},${pointA.lat};${pointB.lng},${pointB.lat}?overview=full&geometries=geojson`
        )
        const data = await response.json()
        if (!response.ok || !data.routes || !data.routes[0]) {
          throw new Error('Route not found')
        }

        const route = data.routes[0]
        const coordinates = route.geometry.coordinates.map(([lng, lat]) => [lat, lng])
        setRouteGeometry(coordinates)
        setRoutePlannerStats({
          distanceKm: route.distance / 1000,
          durationSec: route.duration,
          geometry: coordinates,
        })
      } catch (error) {
        console.error('Route fetch failed:', error)
        setRouteError('Unable to calculate route. Try a different pair of points.')
        setRoutePlannerStats(null)
        setRouteGeometry([])
      } finally {
        setRouteLoading(false)
      }
    }

    fetchRoute()
  }, [pointA, pointB])

  useEffect(() => {
    if (!mapRef.current || communityRoutePositions.length === 0) return
    mapRef.current.fitBounds(communityRoutePositions, { padding: [40, 40] })
  }, [communityRoutePositions])

  return (
    <div className="app-container">
      <div className="main-content">
        <div className="map-wrapper">
          <MapLayersOverlayMenu onToggleLayer={handleToggleLayer} activeLayers={activeLayers} />

          <MapContainer
            center={[43.307, 16.635]}
            zoom={11}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
            whenCreated={(map) => { mapRef.current = map }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='© OpenStreetMap contributors'
            />
            <GpxTrails
              onTracksLoaded={setTrails}
              selectedTrail={selectedTrail}
              onStatsUpdate={handleStatsUpdate}
            />
            <ReportMarkers refreshKey={reportsRefreshKey} />
            <GpsTracker />
            <ReportProblem onReportSaved={() => setReportsRefreshKey((k) => k + 1)} />
            <RoutePlannerMap
              active={plannerTab === 'planNew'}
              pointA={pointA}
              pointB={pointB}
              routeGeometry={routeGeometry}
              onMapClick={handlePlannerMapClick}
            />
            {filteredPois.map((poi) => (
              <Marker
                key={poi.id}
                position={[poi.coordinates.lat, poi.coordinates.lng]}
                pathOptions={{ color: '#ffffff', fillColor: CATEGORY_MAP[poi.category]?.color || '#8b5cf6', fillOpacity: 0.95 }}
              >
                <Popup>
                  <div style={{ minWidth: '160px', color: '#333', fontFamily: 'sans-serif' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '14px' }}>{poi.name}</h4>
                    <span style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>
                      {poi.category.replace('_', ' ')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddPointToRoute(poi.coordinates)}
                      style={{ marginTop: '8px', width: '100%', padding: '6px', background: '#753cae', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      📍 Add to Plan
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
            {communityRoutePositions.length > 0 && (
              <Polyline
                positions={communityRoutePositions}
                pathOptions={{ color: '#a78bfa', weight: 5, opacity: 0.9 }}
              />
            )}
            {hoverPosition && hoverPosition.lat != null && hoverPosition.lng != null && (
              <CircleMarker
                center={[hoverPosition.lat, hoverPosition.lng]}
                radius={8}
                pathOptions={{
                  color: '#ffffff',
                  fillColor: '#4ade80',
                  fillOpacity: 1,
                  weight: 2,
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={1} sticky>
                  <div style={{ color: '#0f172a', fontWeight: 700 }}>
                    {hoverPosition.distance != null ? `${hoverPosition.distance.toFixed(2)} km` : ''}
                    {hoverPosition.elevation != null ? ` · ${Math.round(hoverPosition.elevation)} m` : ''}
                  </div>
                </Tooltip>
              </CircleMarker>
            )}
          </MapContainer>
        </div>

        <BottomSheet
          trails={trails}
          selectedTrail={selectedTrail}
          trailStats={trailStats}
          onTrailClick={handleTrailClick}
          onChartHover={handleChartHover}
          activeTab={plannerTab}
          onTabChange={setPlannerTab}
          onRouteSelect={handleCommunityRouteSelect}
          selectedRouteId={selectedCommunityRoute?.id}
          planNewContent={
            <PlanNewView
              onStartRoute={handleStartRide}
              onSaveRoute={handleSaveRoute}
            />
          }
        />
      </div>
    </div>
  )
}