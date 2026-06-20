import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, Circle, Polyline, useMap } from 'react-leaflet'
import { supabase } from '../supabaseClient'

function haversineDistance([lat1, lng1], [lat2, lng2]) {
  const toRad = (value) => (value * Math.PI) / 180
  const R = 6371 // Earth radius in km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function GpsTracker() {
  const map = useMap()
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  const [recording, setRecording] = useState(false)
  const [trackPoints, setTrackPoints] = useState([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [saveName, setSaveName] = useState('')
  const [savedRoute, setSavedRoute] = useState(null)
  const watchIdRef = useRef(null)
  const intervalRef = useRef(null)

  const totalDistanceKm = useMemo(() => {
    if (trackPoints.length < 2) return 0
    return trackPoints.reduce((sum, point, index) => {
      if (index === 0) return 0
      const prev = trackPoints[index - 1]
      return sum + haversineDistance([prev.lat, prev.lng], [point.lat, point.lng])
    }, 0)
  }, [trackPoints])

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Location access needed to show your position')
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null)
        setPosition(pos)
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location access needed to show your position')
        } else {
          setError('Unable to access location')
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    )

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (recording) {
      intervalRef.current = window.setInterval(() => {
        if (!position) return
        setTrackPoints((current) => [
          ...current,
          {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: position.timestamp,
          },
        ])
      }, 3000)

      return () => {
        if (intervalRef.current != null) {
          clearInterval(intervalRef.current)
        }
      }
    }

    return undefined
  }, [recording, position])

  useEffect(() => {
    if (trackPoints.length === 1 && map) {
      map.flyTo([trackPoints[0].lat, trackPoints[0].lng], 15)
    }
  }, [trackPoints, map])

  const handleRecordToggle = () => {
    if (!recording) {
      setTrackPoints([])
      setElapsedSeconds(0)
      setSaveName('')
      setRecording(true)

      const timer = window.setInterval(() => {
        setElapsedSeconds((current) => current + 1)
      }, 1000)
      intervalRef.current = timer
    } else {
      setRecording(false)
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current)
      }
    }
  }

  const handleSave = async () => {
    const routeName = saveName || `Route ${new Date().toLocaleString()}`
    const distanceKm = Number(totalDistanceKm.toFixed(3))
    const coordinates = trackPoints

    const { error } = await supabase.from('user_routes').insert([
      { name: routeName, coordinates, distance_km: distanceKm },
    ])

    if (error) {
      alert('Unable to save route: ' + error.message)
      return
    }

    setSavedRoute({
      name: routeName,
      coordinates,
      distanceKm,
    })
    setRecording(false)
    setTrackPoints([])
    setElapsedSeconds(0)
    setSaveName('')
  }

  const handleDiscard = () => {
    setRecording(false)
    setTrackPoints([])
    setElapsedSeconds(0)
    setSaveName('')
  }

  if (error) {
    return (
      <div className="gps-tracker-message">
        Location access needed to show your position
      </div>
    )
  }

  return (
    <>
      {position && (
        <>
          <CircleMarker
            center={[position.coords.latitude, position.coords.longitude]}
            radius={8}
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 1, weight: 2 }}
          />
          <Circle
            center={[position.coords.latitude, position.coords.longitude]}
            radius={position.coords.accuracy}
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.12, weight: 1 }}
          />
        </>
      )}
      {trackPoints.length > 1 && (
        <Polyline
          positions={trackPoints.map((point) => [point.lat, point.lng])}
          pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.85 }}
        />
      )}
      <div className="gps-recorder-panel">
        <button
          className="gps-record-button"
          type="button"
          onClick={handleRecordToggle}
        >
          {recording ? '⏹ Stop Recording' : '🔴 Record Route'}
        </button>
        {recording && (
          <div className="gps-record-status">
            <div>Elapsed: {formatTime(elapsedSeconds)}</div>
            <div>Distance: {totalDistanceKm.toFixed(2)} km</div>
          </div>
        )}
        {!recording && trackPoints.length > 0 && (
          <div className="gps-save-panel">
            <input
              className="gps-save-input"
              type="text"
              value={saveName}
              placeholder="Route name"
              onChange={(event) => setSaveName(event.target.value)}
            />
            <div className="gps-save-actions">
              <button className="gps-save-button" type="button" onClick={handleSave}>
                Save Route
              </button>
              <button className="gps-discard-button" type="button" onClick={handleDiscard}>
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default GpsTracker
