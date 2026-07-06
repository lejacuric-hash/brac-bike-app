import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { CircleMarker, Polyline, useMap } from 'react-leaflet'
import { supabase } from '../supabaseClient'
import './RoutePlanner.css'

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

function RoutePlannerUI({
  pointA,
  pointB,
  routeStats,
  plannerMode,
  onSetPlannerMode,
  onUseCurrentLocation,
  onClearRoute,
  onStartRide,
}) {
  const [saveName, setSaveName] = useState('')
  const [saveStatus, setSaveStatus] = useState(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [geoError, setGeoError] = useState(null)

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoError(null)
        onUseCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGeoError('Unable to retrieve your location. Tap the map to set your start point instead.')
        } else {
          setGeoError('Unable to retrieve your location. Tap the map to set your start point instead.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleSaveRoute = async () => {
    if (!routeStats || !routeStats.distanceKm || !pointA || !pointB) {
      alert('Please set both points and compute a route before saving.')
      return
    }

    const routeName = saveName.trim() || `Route ${new Date().toLocaleString()}`
    const coordinates = routeStats.geometry.map(([lat, lng]) => ({ lat, lng }))
    const distanceKm = Number(routeStats.distanceKm.toFixed(3))

    setSaveLoading(true)
    const { error } = await supabase.from('user_routes').insert([
      { name: routeName, coordinates, distance_km: distanceKm },
    ])
    setSaveLoading(false)

    if (error) {
      alert('Unable to save route: ' + error.message)
      return
    }

    setSaveStatus('Route saved successfully!')
    setSaveName('')
  }

  const hasRoute = routeStats && routeStats.distanceKm != null

  return (
    <div className="route-planner-panel">
      <div className="route-planner-row">
        <label>A:</label>
        <div className="route-planner-row-content">
          {!pointA ? (
            <>
              <button type="button" className="route-planner-button" onClick={handleUseLocation}>
                📍 Use My Location
              </button>
              <div className="planner-hint">or tap the map to set start point</div>
            </>
          ) : (
            <div className="planner-ok">
              <span className="planner-ok-text">✅ Start point set</span>
              <button type="button" className="planner-change" onClick={() => onSetPlannerMode('settingA')}>Change</button>
            </div>
          )}
        </div>
      </div>

      <div className="route-planner-row">
        <label>B:</label>
        <div className="route-planner-row-content">
          {!pointB ? (
            <div className="planner-hint">Tap the map to set your destination</div>
          ) : (
            <div className="planner-ok">
              <span className="planner-ok-text">✅ Destination set</span>
              <button type="button" className="planner-change" onClick={() => onSetPlannerMode('settingB')}>Change</button>
            </div>
          )}
        </div>
      </div>

      {geoError && <div className="planner-geo-error">{geoError}</div>}

      {hasRoute && (
        <div className="planner-results">
          <div className="planner-results-row">
            <div>
              <div className="planner-result-label">Distance</div>
              <div className="planner-result-value">{routeStats.distanceKm.toFixed(2)} km</div>
            </div>
            <div>
              <div className="planner-result-label">Estimated Time</div>
              <div className="planner-result-value">{formatDuration(routeStats.durationSec)}</div>
            </div>
          </div>

          <input
            className="planner-save-input"
            type="text"
            value={saveName}
            placeholder="Route name"
            onChange={(event) => setSaveName(event.target.value)}
          />

          <div className="planner-buttons">
            <button
              type="button"
              className="planner-button"
              onClick={handleSaveRoute}
              disabled={saveLoading}
            >
              {saveLoading ? 'Saving…' : '💾 Save Route'}
            </button>
            <button
              type="button"
              className="planner-button secondary"
              onClick={onStartRide}
            >
              ▶️ Start Ride
            </button>
            <button
              type="button"
              className="planner-button clear"
              onClick={onClearRoute}
            >
              Clear
            </button>
          </div>

          {saveStatus && <div className="planner-message">{saveStatus}</div>}
        </div>
      )}
    </div>
  )
}

RoutePlannerUI.propTypes = {
  pointA: PropTypes.shape({ lat: PropTypes.number, lng: PropTypes.number }),
  pointB: PropTypes.shape({ lat: PropTypes.number, lng: PropTypes.number }),
  routeStats: PropTypes.shape({
    distanceKm: PropTypes.number,
    durationSec: PropTypes.number,
    geometry: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
  }),
  plannerMode: PropTypes.oneOf(['settingA', 'settingB']).isRequired,
  onSetPlannerMode: PropTypes.func.isRequired,
  onUseCurrentLocation: PropTypes.func.isRequired,
  onClearRoute: PropTypes.func.isRequired,
  onStartRide: PropTypes.func.isRequired,
}

function RoutePlannerMap({
  active,
  pointA,
  pointB,
  routeGeometry,
  onMapClick,
}) {
  const map = useMap()

  useEffect(() => {
    if (!active) {
      return undefined
    }

    const handleMapClick = (event) => {
      const { lat, lng } = event.latlng
      onMapClick({ lat, lng })
    }

    map.on('click', handleMapClick)
    return () => {
      map.off('click', handleMapClick)
    }
  }, [active, map, onMapClick])

  useEffect(() => {
    if (pointA) {
      map.flyTo([pointA.lat, pointA.lng], 13)
    }
  }, [pointA, map])

  return (
    <>
      {pointA && (
        <CircleMarker
          center={[pointA.lat, pointA.lng]}
          radius={8}
          pathOptions={{ color: '#a78bfa', fillColor: '#a78bfa', fillOpacity: 1, weight: 2 }}
        />
      )}
      {pointB && (
        <CircleMarker
          center={[pointB.lat, pointB.lng]}
          radius={8}
          pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 1, weight: 2 }}
        />
      )}
      {routeGeometry && routeGeometry.length > 0 && (
        <Polyline
          positions={routeGeometry}
          pathOptions={{ color: '#a78bfa', weight: 5, opacity: 0.9 }}
        />
      )}
    </>
  )
}

RoutePlannerMap.propTypes = {
  active: PropTypes.bool,
  pointA: PropTypes.shape({ lat: PropTypes.number, lng: PropTypes.number }),
  pointB: PropTypes.shape({ lat: PropTypes.number, lng: PropTypes.number }),
  routeGeometry: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
  onMapClick: PropTypes.func.isRequired,
}

RoutePlannerMap.defaultProps = {
  active: false,
  pointA: null,
  pointB: null,
  routeGeometry: [],
}

export { RoutePlannerMap, RoutePlannerUI }
export default RoutePlannerUI
