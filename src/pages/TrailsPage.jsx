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

// Ensure your Supabase client is imported correctly
import { supabase } from '../supabaseClient.js'
// Import dynamic POIs
import finalPlacesData from '../final_places.json'

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

export default function TrailsPage() {
  const [trails, setTrails] = useState([])
  const [selectedTrail, setSelectedTrail] = useState(null)
  const [trailStats, setTrailStats] = useState({})
  const [hoverPosition, setHoverPosition] = useState(null)
  const [reportsRefreshKey, setReportsRefreshKey] = useState(0)
  const [plannerTab, setPlannerTab] = useState('routes')
  
  // Custom Planning states
  const [waypoints, setWaypoints] = useState(['', ''])
  const [roadPreference, setRoadPreference] = useState('gravel')
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
  const [mapStyle, setMapStyle] = useState('street') 
  
  // POI & Pill States
  const [showPoiMenu, setShowPoiMenu] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState([])
  
  const [activeRecording, setActiveRecording] = useState(false)
  const [hazards, setHazards] = useState([])

  const mapRef = useRef(null)
  const gpsTrackerRef = useRef(null)
  const reportProblemRef = useRef(null)

  // Fetch hazards from Supabase
  useEffect(() => {
    const fetchHazards = async () => {
      const { data, error } = await supabase.from('reports').select('*')
      if (!error && data) {
        setHazards(data)
      }
    }
    fetchHazards()
  }, [reportsRefreshKey])

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
    if (!showPoiMenu || selectedCategories.length === 0) return []
    return normalizedPois.filter((poi) => selectedCategories.includes(poi.category))
  }, [normalizedPois, showPoiMenu, selectedCategories])

  const handleToggleCategory = (category) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category) 
        : [...prev, category]
    )
  }

  const handleTogglePoiMenu = () => {
    const nextState = !showPoiMenu
    setShowPoiMenu(nextState)
    if (nextState) {
      setSelectedCategories([])
    }
  }

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

  // Dummy route calculation handler to link up the UI fields
  const handleCalculateRoute = async () => {
    setRouteLoading(true)
    setRouteError(null)
    try {
      // Mock Route calculations (replace with your dynamic routing engine call if needed)
      setTimeout(() => {
        setRouteGeometry([[43.307, 16.635], [43.312, 16.645]])
        setRoutePlannerStats({
          distanceKm: 4.2,
          elevationGain: 120,
          geometry: [[43.307, 16.635], [43.312, 16.645]]
        })
        setRouteLoading(false)
      }, 1000)
    } catch (err) {
      setRouteError('Failed to parse route. Check your internet connection.')
      setRouteLoading(false)
    }
  }

  // Construct UI for the Custom Planner Panel
  const planNewContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 0' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 'bold', margin: '0' }}>Plan a Custom Trail</h3>
      
      {waypoints.map((waypoint, idx) => (
        <input
          key={idx}
          type="text"
          placeholder={idx === 0 ? "Start Location" : "End Location"}
          value={waypoint}
          onChange={(e) => {
            const next = [...waypoints]
            next[idx] = e.target.value
            setWaypoints(next)
          }}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #ddd',
            fontSize: '0.9rem'
          }}
        />
      ))}

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
          padding: '10px',
          borderRadius: '8px',
          fontWeight: 'bold',
          cursor: 'pointer',
          opacity: routeLoading ? 0.7 : 1
        }}
      >
        {routeLoading ? 'Calculating Route...' : 'Generate Custom Route'}
      </button>

      {routePlannerStats && (
        <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#f1f5f9', borderRadius: '8px' }}>
          <span style={{ display: 'block', fontSize: '0.85rem' }}>
            <strong>Distance:</strong> {routePlannerStats.distanceKm} km
          </span>
          <span style={{ display: 'block', fontSize: '0.85rem' }}>
            <strong>Elevation Gain:</strong> {routePlannerStats.elevationGain} m
          </span>
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
              marginTop: '8px',
              cursor: 'pointer'
            }}
          >
            Save Route to Account
          </button>
        </div>
      )}
    </div>
  )

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

          {/* CATEGORY FILTER PILL CARD - Displayed dynamically over map */}
          {showPoiMenu && (
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

          <MapContainer
            center={[43.307, 16.635]}
            zoom={11}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
            whenCreated={(map) => { mapRef.current = map }}
          >
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

            {plannerTab !== 'planNew' && !selectedCommunityRoute && (
              <GpxTrails
                onTracksLoaded={setTrails}
                selectedTrail={selectedTrail}
                onStatsUpdate={handleStatsUpdate}
              />
            )}
            
            <ReportMarkers refreshKey={reportsRefreshKey} />
            <GpsTracker ref={gpsTrackerRef} />
            <ReportProblem ref={reportProblemRef} onReportSaved={() => setReportsRefreshKey((k) => k + 1)} />

            {/* Dynamic filtered Places from final_places.json */}
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

            {plannerTab === 'routes' && selectedCommunityRoute && communityRoutePositions.length > 0 && (
              <Polyline
                positions={communityRoutePositions}
                pathOptions={{ color: '#a78bfa', weight: 3, opacity: 0.9 }}
              />
            )}

            {plannerTab === 'planNew' && routeGeometry.length > 0 && (
              <Polyline
                positions={routeGeometry}
                pathOptions={{ color: '#00e676', weight: 3, opacity: 0.95 }}
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
          planNewContent={planNewContent}
        />
      </div>
    </div>
  )
}