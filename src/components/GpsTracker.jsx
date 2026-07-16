import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
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
  const hrs = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hrs.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const GpsTracker = forwardRef(function GpsTracker({ onRideSaved, activeRouteId = null }, ref) {
  const map = useMap()
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  const [recording, setRecording] = useState(false)
  const [trackPoints, setTrackPoints] = useState([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [routeName, setRouteName] = useState('')
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [rating, setRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [savingRide, setSavingRide] = useState(false)
  const [saveError, setSaveError] = useState(null)
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

  const maxElevationM = useMemo(() => {
    const validElevations = trackPoints
      .map((point) => point.altitude)
      .filter((value) => Number.isFinite(value))

    if (validElevations.length === 0) return 0
    return Math.max(...validElevations)
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
            altitude: position.coords.altitude,
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
      setRouteName(`Ride ${new Date().toLocaleDateString()}`)
      setReviewComment('')
      setRating(5)
      setSaveError(null)
      setShowSummaryModal(false)
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
      if (trackPoints.length > 1) {
        setShowSummaryModal(true)
      }
    }
  }

  useImperativeHandle(ref, () => ({
    toggleRecording: handleRecordToggle,
  }))

  const handleSaveRideAndReview = async () => {
    const nextRouteName = routeName || `Ride ${new Date().toLocaleString()}`
    const distanceKm = Number(totalDistanceKm.toFixed(3))
    const coordinates = trackPoints
    const recordedPath = trackPoints.map((point) => ({
      lat: point.lat,
      lng: point.lng,
      altitude: point.altitude,
      timestamp: point.timestamp,
    }))
    const durationSec = elapsedSeconds
    const maxElevation = Number(maxElevationM.toFixed(1))

    setSavingRide(true)
    setSaveError(null)

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user?.id) {
      setSavingRide(false)
      setSaveError('You must be signed in to save rides and reviews.')
      return
    }

    const { data: routeData, error: routeError } = await supabase
      .from('user_routes')
      .insert([
        { name: nextRouteName, coordinates, distance_km: distanceKm },
      ])
      .select('id, name')
      .single()

    if (routeError) {
      setSavingRide(false)
      setSaveError('Unable to save route: ' + routeError.message)
      return
    }

    const { data: completedRideData, error: completedRideError } = await supabase
      .from('completed_rides')
      .insert([
        {
          user_id: user.id,
          route_id: activeRouteId || null,
          distance_km: distanceKm,
          duration_seconds: durationSec,
          elevation_max: maxElevation,
          recorded_path: recordedPath,
        },
      ])
      .select('id')
      .single()

    if (completedRideError) {
      setSavingRide(false)
      setSaveError('Unable to save completed ride: ' + completedRideError.message)
      return
    }

    if (activeRouteId) {
      const { error: reviewError } = await supabase
        .from('route_reviews')
        .insert([
          {
            route_id: activeRouteId,
            user_id: user.id,
            rating,
            comment: reviewComment || null,
          },
        ])

      if (reviewError) {
        setSavingRide(false)
        setSaveError('Unable to publish review: ' + reviewError.message)
        return
      }
    }

    setSavingRide(false)
    setShowSummaryModal(false)
    if (typeof onRideSaved === 'function') {
      onRideSaved()
    }

    setRecording(false)
    setTrackPoints([])
    setElapsedSeconds(0)
    setRouteName('')
    setReviewComment('')
    setRating(5)
  }

  const handleDiscard = () => {
    setShowSummaryModal(false)
    setRecording(false)
    setTrackPoints([])
    setElapsedSeconds(0)
    setRouteName('')
    setReviewComment('')
    setRating(5)
    setSaveError(null)
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
        {recording && (
          <div className="gps-record-status">
            <div>Elapsed: {formatTime(elapsedSeconds)}</div>
            <div>Distance: {totalDistanceKm.toFixed(2)} km</div>
          </div>
        )}
      </div>

      {showSummaryModal && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(2, 6, 23, 0.72)',
          zIndex: 1400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}>
          <div style={{
            width: '100%',
            maxWidth: '440px',
            background: '#0f172a',
            color: '#f8fafc',
            borderRadius: '14px',
            border: '1px solid rgba(148, 163, 184, 0.35)',
            padding: '16px',
            boxShadow: '0 10px 35px rgba(2, 6, 23, 0.45)',
          }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Ride Summary</h3>
            <div style={{ fontSize: '0.9rem', marginBottom: '4px' }}>
              <strong>Total Distance Biked:</strong> {totalDistanceKm.toFixed(2)} km
            </div>
            <div style={{ fontSize: '0.9rem', marginBottom: '4px' }}>
              <strong>Time Spent:</strong> {formatTime(elapsedSeconds)}
            </div>
            <div style={{ fontSize: '0.9rem', marginBottom: '12px' }}>
              <strong>Max Elevation Reached:</strong> {Math.round(maxElevationM)} m
            </div>

            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>Route Name</label>
            <input
              type="text"
              value={routeName}
              onChange={(event) => setRouteName(event.target.value)}
              placeholder="My Ride"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(148, 163, 184, 0.45)',
                background: '#111827',
                color: '#f8fafc',
                marginBottom: '10px',
              }}
            />

            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '6px' }}>Star Rating</label>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: value <= rating ? '#fbbf24' : '#64748b',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  aria-label={`Rate ${value} star${value > 1 ? 's' : ''}`}
                >
                  ★
                </button>
              ))}
            </div>

            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>Review comments/tips</label>
            <textarea
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              rows={3}
              placeholder="Trail condition, hazards, best time to ride..."
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(148, 163, 184, 0.45)',
                background: '#111827',
                color: '#f8fafc',
                marginBottom: '10px',
                resize: 'vertical',
              }}
            />

            {saveError && (
              <div style={{ color: '#fda4af', fontSize: '0.8rem', marginBottom: '8px' }}>{saveError}</div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleDiscard}
                disabled={savingRide}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(148, 163, 184, 0.45)',
                  background: '#1e293b',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                }}
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSaveRideAndReview}
                disabled={savingRide}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#22c55e',
                  color: '#052e16',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {savingRide ? 'Saving...' : 'Save Ride & Publish Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
})

export default GpsTracker
