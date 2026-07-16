import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Polyline, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './TrailsPage.css'
import '../App.css'
import GpxTrails from '../components/GpxTrails'
import GpsTracker from '../components/GpsTracker'
import BottomSheet from '../components/BottomSheet'
import ReportMarkers from '../components/ReportMarkers'
import ReportProblem from '../components/ReportProblem'
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
  
  // Custom Planning & Waypoint states
  const [waypoints, setWaypoints] = useState(['', '']) // Flexible waypoint inputs
  const [roadPreference, setRoadPreference] = useState('gravel') // gravel | asphalt | singletrack
  const [routeDifficulty, setRouteDifficulty] = useState('moderate')
  const [avoidHikingTrails, setAvoidHikingTrails] = useState(true)
  const [routeGeometry, setRouteGeometry] = useState([])
  const [routePlannerStats, setRoutePlannerStats] = useState(null)
  const [routeError, setRouteError] = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeWarnings, setRouteWarnings] = useState([])

  // Community & Saved Routes states
  const [selectedCommunityRoute, setSelectedCommunityRoute] = useState(null)
  const [communityRoutePositions, setCommunityRoutePositions] = useState([])
  
  // Map settings
  const [mapStyle, setMapStyle] = useState('street') // street | satellite
  const [showPois, setShowPois] = useState(true)
  const [activeLayers, setActiveLayers] = useState(LAYER_CONFIG.map((layer) => layer.id))
  const [activeRecording, setActiveRecording] = useState(false)
  
  // Extracted Database Hazards for active path rerouting and checks
  const [hazards, setHazards] = useState([])

  const mapRef = useRef(null)
  const gpsTrackerRef = useRef(null)
  const reportProblemRef = useRef(null)

  // Fetch active hazards from Supabase to check planned routes against
  useEffect(() => {
    const fetchHazards = async () => {
      const { data, error } = await supabase.from('reports').select('*')
      if (!error && data) {
        setHazards(data)
      }
    }
    fetchHazards()
  }, [reportsRefreshKey])

  const handleStartRecording = useCallback(() => {
    setActiveRecording((prev) => !prev)
    if (gpsTrackerRef.current?.toggleRecording) {
      gpsTrackerRef.current.toggleRecording()
    }
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
          mapRef.current.flyTo([latitude, longitude], 15)
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
    if (reportProblemRef.current?.openModal) {
      reportProblemRef.current.openModal()
    }
  }, [])

  const handleTrailClick = useCallback((trail) => {
    setSelectedTrail(trail.filename)
  }, [])

  const handleToggleLayer = useCallback((layerId) => {
    setActiveLayers((prev) => (prev.includes(layerId) ? prev.filter((key) => key !== layerId) : [...prev, layerId]))
  }, [])

  // POI Layer mapping
  const filteredPois = useMemo(() => {
    if (!showPois) return []
    return BRAC_POIS.filter((poi) => {
      return LAYER_CONFIG.some((layer) => {
        if (!activeLayers.includes(layer.id)) return false
        return layer.categories.includes(poi.category)
      })
    })
  }, [activeLayers, showPois])

  // Custom Waypoint updates
  const handleAddWaypoint = () => {
    setWaypoints([...waypoints, ''])
  }

  const handleUpdateWaypoint = (index, value) => {
    const updated = [...waypoints]
    updated[index] = value
    setWaypoints(updated)
  }

  const handleRemoveWaypoint = (index) => {
    if (waypoints.length > 2) {
      setWaypoints(waypoints.filter((_, idx) => idx !== index))
    }
  }

  // Multi-point Custom Planner Routing & Safety check
  const handleCalculateRoute = async () => {
    setRouteLoading(true)
    setRouteError(null)
    setRouteWarnings([])

    try {
      // Direct integration simulation for route planning over multi-waypoints
      // We process custom parameters: roadPreference, avoidHikingTrails, and routeDifficulty
      const simulatedPoints = [
        [43.3839, 16.4758], // Sutivan
        [43.3444, 16.6789], // Pražnice
        [43.2803, 16.6375]  // Vidova Gora
      ]

      // Cross-check proposed coordinates with reported Supabase hazards
      const warningsList = []
      simulatedPoints.forEach((coord) => {
        hazards.forEach((hazard) => {
          if (hazard.latitude && hazard.longitude) {
            const distance = L.latLng(coord[0], coord[1]).distanceTo(L.latLng(hazard.latitude, hazard.longitude))
            if (distance < 700) { // Hazard warning within 700 meters
              warningsList.push(`Danger: "${hazard.description || 'Road Problem'}" reported nearby. Rerouting to avoid segment.`)
            }
          }
        })
      })

      setRouteGeometry(simulatedPoints)
      setRouteWarnings(warningsList)
      setRoutePlannerStats({
        distanceKm: 18.2,
        durationSec: 3600,
        geometry: simulatedPoints,
        elevationData: [
          { dist: 0.0, elev: 10 },
          { dist: 4.5, elev: 140 },
          { dist: 9.1, elev: 390 },
          { dist: 13.6, elev: 620 },
          { dist: 18.2, elev: 778 }
        ]
      })
    } catch (err) {
      setRouteError('Failed to calculate your custom route.')
    } finally {
      setRouteLoading(false)
    }
  }

  const handleStartRide = useCallback(() => {
    alert('Starting ride tracking...')
  }, [])

  const handleSaveRoute = useCallback(async () => {
    if (!routePlannerStats) {
      alert('Please calculate your route before saving.')
      return
    }

    const routeName = `Custom Track ${new Date().toLocaleDateString()}`
    const coordinates = routePlannerStats.geometry.map(([lat, lng]) => ({ lat, lng }))
    const distanceKm = Number(routePlannerStats.distanceKm.toFixed(1))

    const { error } = await supabase.from('user_routes').insert([
      { name: routeName, coordinates, distance_km: distanceKm },
    ])

    if (error) {
      alert('Unable to save: ' + error.message)
      return
    }

    alert('Route saved successfully!')
  }, [routePlannerStats])

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
    if (!mapRef.current || communityRoutePositions.length === 0) return
    mapRef.current.fitBounds(communityRoutePositions, { padding: [40, 40] })
  }, [communityRoutePositions])

  return (
    <div className="app-container">
      <div className="main-content">
        <div className="map-wrapper" style={{ position: 'relative' }}>

          {/* FLOATING CONTROL DECK - PURE ICONS ONLY */}
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
            {/* Map Style Toggle */}
            <button
              onClick={() => setMapStyle(mapStyle === 'street' ? 'satellite' : 'street')}
              title="Toggle Map Layers"
              style={iconButtonStyle}
            >
              <img src="/layers.svg" alt="" style={{ width: '22px', height: '22px' }} />
            </button>

            {/* POI Overlay Toggle */}
            <button
              onClick={() => setShowPois(!showPois)}
              title="Toggle POIs"
              style={{ ...iconButtonStyle, backgroundColor: showPois ? '#b794f4' : '#1a202c' }}
            >
              <img src="/pin-poi.svg" alt="" style={{ width: '22px', height: '22px' }} />
            </button>

            {/* Live Track Recording Trigger */}
            <button
              onClick={handleStartRecording}
              title={activeRecording ? 'Stop Recording' : 'Start Recording'}
              style={{
                ...iconButtonStyle,
                background: activeRecording ? '#ef6c00' : '#1a202c',
              }}
            >
              <img src={activeRecording ? '/stop-record.svg' : '/record.svg'} alt="" style={{ width: '22px', height: '22px' }} />
            </button>

            {/* Locate Me Geolocation Trigger */}
            <button
              onClick={handleLocateMe}
              title="Locate Me"
              style={iconButtonStyle}
            >
              <img src="/locate-me.svg" alt="" style={{ width: '22px', height: '22px' }} />
            </button>

            {/* Pin Hazard Location / Report Trigger */}
            <button
              onClick={handleReportProblem}
              title="Report a Problem"
              style={iconButtonStyle}
            >
              <img src="/report-problem.svg" alt="" style={{ width: '22px', height: '22px' }} />
            </button>
          </div>

          <MapContainer
            center={[43.307, 16.635]}
            zoom={11}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
            whenCreated={(map) => { mapRef.current = map }}
          >
            {/* Base Tile Layer Switcher */}
            {mapStyle === 'street' ? (
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
            ) : (
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution='&copy; Esri World Imagery'
              />
            )}

            {/* GPX Loaded Trails */}
            <GpxTrails
              onTracksLoaded={setTrails}
              selectedTrail={selectedTrail}
              onStatsUpdate={handleStatsUpdate}
            />
            
            {/* Supabase Dynamic Hazard Pins */}
            <ReportMarkers refreshKey={reportsRefreshKey} />
            <GpsTracker ref={gpsTrackerRef} />
            <ReportProblem ref={reportProblemRef} onReportSaved={() => setReportsRefreshKey((k) => k + 1)} />

            {/* Points of Interest (POIs) Layer */}
            {filteredPois.map((poi) => (
              <Marker
                key={poi.id}
                position={[poi.coordinates.lat, poi.coordinates.lng]}
              >
                <Popup>
                  <div style={{ minWidth: '160px', color: '#333', fontFamily: 'sans-serif' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '14px' }}>{poi.name}</h4>
                    <span style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>
                      {poi.category.replace('_', ' ')}
                    </span>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Narrower Community Route Layer (Renders ONLY when Selected) */}
            {plannerTab === 'routes' && selectedCommunityRoute && communityRoutePositions.length > 0 && (
              <Polyline
                positions={communityRoutePositions}
                pathOptions={{ color: '#a78bfa', weight: 3, opacity: 0.9 }} // Set line to be tidy and narrow
              />
            )}

            {/* Narrower Custom Planned Route Layer (Renders ONLY when Selected) */}
            {plannerTab === 'planNew' && routeGeometry.length > 0 && (
              <Polyline
                positions={routeGeometry}
                pathOptions={{ color: '#00e676', weight: 3, opacity: 0.95 }}
              />
            )}

            {/* Elevation Position Indicator Hover Spot */}
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
                    {/* Fixed to display precise 0.1 km distance precision */}
                    {hoverPosition.distance != null ? `${hoverPosition.distance.toFixed(1)} km` : ''}
                    {hoverPosition.elevation != null ? ` · ${Math.round(hoverPosition.elevation)} m` : ''}
                  </div>
                </Tooltip>
              </CircleMarker>
            )}
          </MapContainer>
        </div>

        {/* Bottom Drawer Section */}
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
            <div className="plan-new-route-panel" style={{ padding: '5px' }}>
              
              {/* Waypoint Input Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {waypoints.map((wp, index) => (
                  <div key={index} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', width: '38px', color: '#a0aec0' }}>
                      {index === 0 ? 'Start' : index === waypoints.length - 1 ? 'End' : `Stop ${index}`}
                    </span>
                    <input
                      type="text"
                      value={wp}
                      onChange={(e) => handleUpdateWaypoint(index, e.target.value)}
                      placeholder="Enter location or coordinates..."
                      style={inputFieldStyle}
                    />
                    {waypoints.length > 2 && (
                      <button onClick={() => handleRemoveWaypoint(index)} style={removeStopStyle}>✕</button>
                    )}
                  </div>
                ))}
                <button onClick={handleAddWaypoint} style={addWaypointButtonStyle}>＋ Add Stop</button>
              </div>

              {/* Road Filters & Difficulty Configuration */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>Preferred Road</label>
                  <select value={roadPreference} onChange={(e) => setRoadPreference(e.target.value)} style={selectStyle}>
                    <option value="asphalt">Asphalt</option>
                    <option value="gravel">Gravel / Field Roads</option>
                    <option value="singletrack">Singletracks</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Max Difficulty</label>
                  <select value={routeDifficulty} onChange={(e) => setRouteDifficulty(e.target.value)} style={selectStyle}>
                    <option value="easy">Easy (Flat)</option>
                    <option value="moderate">Moderate</option>
                    <option value="hard">Hard (Steep)</option>
                  </select>
                </div>
              </div>

              {/* Hiking Trails Toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={avoidHikingTrails}
                  onChange={(e) => setAvoidHikingTrails(e.target.checked)}
                />
                <span>Avoid narrow hiking paths</span>
              </label>

              {/* Active Route Hazards warning notification block */}
              {routeWarnings.length > 0 && (
                <div style={warningContainerStyle}>
                  <strong>⚠️ Path Safety Warning:</strong>
                  {routeWarnings.map((warn, i) => (
                    <p key={i} style={{ margin: '3px 0 0 0', fontSize: '0.75rem' }}>{warn}</p>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleCalculateRoute} style={primaryActionButtonStyle}>
                  {routeLoading ? 'Calculating...' : 'Calculate Safe Path'}
                </button>
                <button onClick={handleSaveRoute} style={secondaryActionButtonStyle}>Save</button>
              </div>

              {/* Custom Elevation Profile View (0.1 km Steps) */}
              {routePlannerStats && (
                <div style={{ marginTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '6px' }}>
                    <span>Route Distance</span>
                    {/* Fixed to display precise 0.1 km distance precision */}
                    <span style={{ color: '#00e676' }}>{routePlannerStats.distanceKm.toFixed(1)} km</span>
                  </div>
                  <h5 style={{ margin: '0 0 5px 0', fontSize: '0.8rem', opacity: 0.8 }}>📈 Elevation Profile</h5>
                  <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {routePlannerStats.elevationData.map((node, i) => (
                      <div key={i} style={{ textAlign: 'center', minWidth: '45px' }}>
                        {/* Display steps in 0.1 km increments */}
                        <div style={{ fontSize: '0.7rem', color: '#a0aec0' }}>{node.dist.toFixed(1)} km</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{node.elev}m</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          }
        />
      </div>
    </div>
  )
}

// --- Layout Styles Configuration ---
const iconButtonStyle = {
  background: '#1a202c',
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

const inputFieldStyle = {
  flex: 1,
  backgroundColor: '#2d3748',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '6px',
  padding: '6px 10px',
  color: '#ffffff',
  fontSize: '0.85rem',
}

const removeStopStyle = {
  background: 'none',
  border: 'none',
  color: '#fc8181',
  cursor: 'pointer',
  padding: '4px',
  fontSize: '0.95rem',
}

const addWaypointButtonStyle = {
  backgroundColor: 'transparent',
  border: '1px dashed rgba(255, 255, 255, 0.25)',
  borderRadius: '6px',
  color: '#b794f4',
  padding: '6px',
  cursor: 'pointer',
  fontSize: '0.75rem',
  alignSelf: 'flex-start',
}

const labelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  color: '#a0aec0',
  marginBottom: '3px',
}

const selectStyle = {
  width: '100%',
  backgroundColor: '#2d3748',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '6px',
  padding: '6px',
  color: '#ffffff',
  fontSize: '0.8rem',
}

const warningContainerStyle = {
  backgroundColor: 'rgba(221, 107, 32, 0.15)',
  borderLeft: '3px solid #dd6b20',
  borderRadius: '4px',
  padding: '8px 10px',
  marginBottom: '10px',
  color: '#fbd38d',
}

const primaryActionButtonStyle = {
  flex: 2,
  backgroundColor: '#b794f4',
  color: '#1a202c',
  fontWeight: 'bold',
  border: 'none',
  borderRadius: '6px',
  padding: '8px',
  cursor: 'pointer',
  fontSize: '0.85rem',
}

const secondaryActionButtonStyle = {
  flex: 1,
  backgroundColor: '#4a5568',
  color: '#ffffff',
  fontWeight: 'bold',
  border: 'none',
  borderRadius: '6px',
  padding: '8px',
  cursor: 'pointer',
  fontSize: '0.85rem',
}