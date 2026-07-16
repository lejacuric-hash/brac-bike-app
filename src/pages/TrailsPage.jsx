import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Polyline, Tooltip, useMapEvents } from 'react-leaflet'
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

// Fix Leaflet default marker URLs for Vite/mobile builds.
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function ReportPinDropListener({ enabled, onPick }) {
  useMapEvents({
    click(event) {
      if (!enabled) return
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng })
    },
  })

  return null
}

function haversineDistanceKm([lat1, lng1], [lat2, lng2]) {
  const toRad = (value) => (value * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
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
  const [isDropPinMode, setIsDropPinMode] = useState(false)
  const [reportCoordinates, setReportCoordinates] = useState(null)
  const [routeFeedbackRefreshKey, setRouteFeedbackRefreshKey] = useState(0)

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
    if (selectedCategories.length === 0) return []
    return normalizedPois.filter((poi) => selectedCategories.includes(poi.category))
  }, [normalizedPois, selectedCategories])

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
          mapRef.current.flyTo([latitude, longitude], 18, { animate: true, duration: 1.5 })
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

  const handleWaypointAddressChange = useCallback((index, value) => {
    setWaypoints((prev) => prev.map((waypoint, idx) => (
      idx === index ? { ...waypoint, address: value } : waypoint
    )))
  }, [])

  const handleWaypointLatChange = useCallback((index, value) => {
    const nextLat = Number(value)
    const currentLng = waypoints[index]?.latlng?.[1]
    updateWaypointLatLng(index, Number.isFinite(nextLat) ? nextLat : NaN, currentLng)
  }, [updateWaypointLatLng, waypoints])

  const handleWaypointLngChange = useCallback((index, value) => {
    const nextLng = Number(value)
    const currentLat = waypoints[index]?.latlng?.[0]
    updateWaypointLatLng(index, currentLat, Number.isFinite(nextLng) ? nextLng : NaN)
  }, [updateWaypointLatLng, waypoints])

  const handleAddWaypoint = useCallback(() => {
    setWaypoints((prev) => [...prev, createWaypoint(prev.length + 1)])
  }, [])

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

  const calculateRouteFromWaypoints = useCallback(async (coords) => {
    if (coords.length < 2) {
      setRouteGeometry([])
      setRoutePlannerStats(null)
      return
    }

    setRouteLoading(true)
    setRouteError(null)

    try {
      const osrmCoordinates = coords.map(([lat, lng]) => `${lng},${lat}`).join(';')
      const routeResponse = await fetch(`https://router.project-osrm.org/route/v1/driving/${osrmCoordinates}?overview=full&geometries=geojson`)

      let geometry
      let distanceKm

      if (routeResponse.ok) {
        const osrmData = await routeResponse.json()
        const route = osrmData?.routes?.[0]

        if (!route?.geometry?.coordinates?.length) {
          throw new Error('No valid route returned')
        }

        geometry = route.geometry.coordinates.map(([lng, lat]) => [lat, lng])
        distanceKm = route.distance / 1000
      } else {
        geometry = coords
        distanceKm = coords.reduce((sum, point, idx) => {
          if (idx === 0) return 0
          return sum + haversineDistanceKm(coords[idx - 1], point)
        }, 0)
      }

      const elevationProfile = await fetchElevationProfile(geometry)
      const maxElevation = elevationProfile.length > 0
        ? Math.max(...elevationProfile.map((entry) => entry.elev))
        : null

      setRouteGeometry(geometry)
      setRoutePlannerStats({
        distanceKm,
        durationSec: (distanceKm / 15) * 3600,
        maxElevation,
        elevationProfile,
        geometry,
      })
    } catch (err) {
      setRouteError('Failed to calculate route. Please adjust waypoint coordinates and try again.')
      setRouteGeometry([])
      setRoutePlannerStats(null)
    } finally {
      setRouteLoading(false)
    }
  }, [fetchElevationProfile])

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

  // Construct UI for the Custom Planner Panel
  const planNewContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 0' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 'bold', margin: '0' }}>Plan a Custom Trail</h3>
      
      {waypoints.map((waypoint, idx) => (
        <div key={waypoint.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <input
            type="text"
            placeholder={`Waypoint ${idx + 1} address`}
            value={waypoint.address}
            onChange={(e) => handleWaypointAddressChange(idx, e.target.value)}
            style={{
              gridColumn: '1 / span 2',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              fontSize: '0.9rem',
            }}
          />
          <input
            type="number"
            step="any"
            placeholder="Latitude"
            value={waypoint.latlng?.[0] ?? ''}
            onChange={(e) => handleWaypointLatChange(idx, e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.85rem' }}
          />
          <input
            type="number"
            step="any"
            placeholder="Longitude"
            value={waypoint.latlng?.[1] ?? ''}
            onChange={(e) => handleWaypointLngChange(idx, e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.85rem' }}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={handleAddWaypoint}
        style={{
          background: '#1f2937',
          color: '#ffffff',
          border: '1px solid #374151',
          padding: '8px 10px',
          borderRadius: '8px',
          fontWeight: 'bold',
          cursor: 'pointer',
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
            <strong>Distance:</strong> {routePlannerStats.distanceKm.toFixed(2)} km
          </span>
          <span style={{ display: 'block', fontSize: '0.85rem' }}>
            <strong>Estimated Time:</strong> {(routePlannerStats.durationSec / 3600).toFixed(2)} h
          </span>
          <span style={{ display: 'block', fontSize: '0.85rem' }}>
            <strong>Max Elevation:</strong> {routePlannerStats.maxElevation != null ? `${Math.round(routePlannerStats.maxElevation)} m` : 'N/A'}
          </span>
          <div style={{ marginTop: '8px' }}>
            <strong style={{ fontSize: '0.8rem' }}>Elevation Profile</strong>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '70px', marginTop: '6px' }}>
              {routePlannerStats.elevationProfile.map((entry, idx, arr) => {
                const maxElevation = Math.max(...arr.map((item) => item.elev), 1)
                const height = Math.max(4, (entry.elev / maxElevation) * 64)
                return (
                  <div
                    key={`${entry.distKm}-${idx}`}
                    title={`${entry.distKm.toFixed(1)} km | ${Math.round(entry.elev)} m`}
                    style={{ width: '6px', height: `${height}px`, background: '#6366f1', borderRadius: '2px' }}
                  />
                )
              })}
            </div>
          </div>
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
            <GpsTracker
              ref={gpsTrackerRef}
              onRideSaved={() => setRouteFeedbackRefreshKey((value) => value + 1)}
            />
            <ReportProblem
              ref={reportProblemRef}
              initialCoordinates={reportCoordinates}
              onRequestDropPin={handleDropPinRequest}
              onReportSaved={() => setReportsRefreshKey((k) => k + 1)}
            />
            <ReportPinDropListener enabled={isDropPinMode} onPick={handleMapReportPinPick} />

            {plannerTab === 'planNew' && waypoints.map((waypoint, index) => (
              waypoint.latlng ? (
                <Marker
                  key={waypoint.id}
                  position={waypoint.latlng}
                  draggable={true}
                  eventHandlers={{
                    dragend: (event) => {
                      const dragged = event.target.getLatLng()
                      updateWaypointLatLng(index, dragged.lat, dragged.lng)
                    },
                  }}
                >
                  <Popup>Waypoint {index + 1}</Popup>
                </Marker>
              ) : null
            ))}

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
          routeFeedbackRefreshKey={routeFeedbackRefreshKey}
          planNewContent={planNewContent}
        />
      </div>
    </div>
  )
}