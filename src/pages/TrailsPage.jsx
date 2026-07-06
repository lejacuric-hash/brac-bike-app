import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline } from 'react-leaflet'
import './TrailsPage.css'
import '../App.css'
import GpxTrails from '../components/GpxTrails'
import GpsTracker from '../components/GpsTracker'
import BottomSheet from '../components/BottomSheet'
import { RoutePlannerMap, RoutePlannerUI } from '../components/RoutePlanner'
import ReportMarkers from '../components/ReportMarkers'
import ReportProblem from '../components/ReportProblem'
import { BRAC_POIS } from '../data/poiData'

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
  const [activeCategories, setActiveCategories] = useState(Object.keys(CATEGORY_MAP))
  const [selectedPoi, setSelectedPoi] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const mapRef = useRef(null)

  const handleTrailClick = useCallback((trail) => {
    setSelectedTrail(trail.filename)
  }, [])

  const handleToggleCategory = useCallback((catKey) => {
    setActiveCategories((prev) =>
      prev.includes(catKey) ? prev.filter((key) => key !== catKey) : [...prev, catKey]
    )
  }, [])

  const filteredPois = useMemo(() => {
    const normalizedTerm = searchTerm.toLowerCase()

    return BRAC_POIS.filter((poi) => {
      const matchesCategory =
        activeCategories.includes(poi.category) ||
        poi.subCategories?.some((sub) => activeCategories.includes(sub))
      const matchesSearch =
        poi.name.toLowerCase().includes(normalizedTerm) ||
        poi.shortDesc.toLowerCase().includes(normalizedTerm) ||
        poi.story.toLowerCase().includes(normalizedTerm)

      return matchesCategory && matchesSearch
    })
  }, [activeCategories, searchTerm])

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
          <div className="explorer-overlay">
            <div className="explorer-panel">
              <input
                type="text"
                className="explorer-search"
                placeholder="🔎 Search Brač POIs, viewpoints, water, gastro..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <div className="category-scroll">
                {Object.entries(CATEGORY_MAP).map(([key, config]) => {
                  const isActive = activeCategories.includes(key)

                  return (
                    <button
                      key={key}
                      type="button"
                      className={`category-pill${isActive ? ' active' : ''}`}
                      style={{ backgroundColor: isActive ? config.color : '#250046' }}
                      onClick={() => handleToggleCategory(key)}
                    >
                      {config.label} {isActive ? '✓' : ''}
                    </button>
                  )
                })}
              </div>
              <div className="filter-caption">Showing {filteredPois.length} active markers on the guide</div>
            </div>
          </div>

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
            <RoutePlannerMap
              active={plannerTab === 'planNew'}
              pointA={pointA}
              pointB={pointB}
              routeGeometry={routeGeometry}
              onMapClick={handlePlannerMapClick}
            />
            {filteredPois.map((poi) => (
              <CircleMarker
                key={poi.id}
                center={[poi.coordinates.lat, poi.coordinates.lng]}
                radius={8}
                eventHandlers={{ click: () => setSelectedPoi(poi) }}
                pathOptions={{
                  color: '#ffffff',
                  fillColor: CATEGORY_MAP[poi.category]?.color || '#8b5cf6',
                  fillOpacity: 0.95,
                  weight: 2,
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={1} sticky>
                  <div className="poi-tooltip">{poi.name}</div>
                </Tooltip>
              </CircleMarker>
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
          <ReportProblem onReportSaved={() => setReportsRefreshKey((k) => k + 1)} />
          {selectedPoi && (
            <div className="story-panel open">
              <div className="story-panel-header">
                <div>
                  <span className="story-badge" style={{ backgroundColor: CATEGORY_MAP[selectedPoi.category]?.color || '#8b5cf6' }}>
                    {selectedPoi.category.toUpperCase()}
                  </span>
                  <h3>{selectedPoi.name}</h3>
                  <p>
                    📍 {selectedPoi.township.toUpperCase()} · Amenities: {selectedPoi.amenities.join(', ')}
                  </p>
                </div>
                <button type="button" className="story-close" onClick={() => setSelectedPoi(null)}>
                  ✕
                </button>
              </div>
              <div className="story-body">
                “{selectedPoi.story}”
              </div>
              <button type="button" className="story-action">
                🗺️ Route me here
              </button>
            </div>
          )}
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
            <RoutePlannerUI
              pointA={pointA}
              pointB={pointB}
              routeStats={routePlannerStats}
              plannerMode={plannerMode}
              onSetPlannerMode={setPlannerMode}
              onUseCurrentLocation={handleUseCurrentLocation}
              onClearRoute={handleClearPlanner}
              onStartRide={handleStartRide}
            />
          }
        />
      </div>
    </div>
  )
}