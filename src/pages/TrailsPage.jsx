import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline } from 'react-leaflet'
import './TrailsPage.css'
import '../App.css'
import GpxTrails from '../components/GpxTrails'
import GpsTracker from '../components/GpsTracker'
import BottomSheet from '../components/BottomSheet'
import { RoutePlannerMap, RoutePlannerUI } from '../components/RoutePlanner'
import ReportMarkers from '../components/ReportMarkers'
import ReportProblem from '../components/ReportProblem'

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
  const mapRef = useRef(null)

  const handleTrailClick = useCallback((trail) => {
    setSelectedTrail(trail.filename)
  }, [])

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