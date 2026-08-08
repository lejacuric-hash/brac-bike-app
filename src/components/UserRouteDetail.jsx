import { useEffect, useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../supabaseClient'
import { haversineDistanceKm } from '../utils/geo'
import ReviewsSection from './ReviewsSection'
import PhotoGallery from './PhotoGallery'
import PhotoFullscreenOverlay from './PhotoFullscreenOverlay'

const CHART_COLOR = '#3b82f6'

function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.round((totalSeconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

// track_points is [{lat, lng, altitude, timestamp}, ...] in recording order —
// a single running total is enough to get cumulative distance per point,
// rather than resumming from the start for every point.
function buildElevationProfile(trackPoints) {
  if (!Array.isArray(trackPoints) || trackPoints.length === 0) return []

  let cumulativeKm = 0
  return trackPoints.map((point, index) => {
    if (index > 0) {
      const prev = trackPoints[index - 1]
      cumulativeKm += haversineDistanceKm([prev.lat, prev.lng], [point.lat, point.lng])
    }
    return {
      distance: Number(cumulativeKm.toFixed(2)),
      elevation: point.altitude || 0,
      lat: point.lat,
      lng: point.lng,
    }
  })
}

export default function UserRouteDetail({ route, onBack }) {
  const [loading, setLoading] = useState(true)
  const [completedRide, setCompletedRide] = useState(null)
  const [reviews, setReviews] = useState([])
  const [photos, setPhotos] = useState([])
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null)

  useEffect(() => {
    if (!route?.id) return undefined
    let cancelled = false

    const fetchDetail = async () => {
      setLoading(true)

      const [ridesResult, reviewsResult, photosResult] = await Promise.all([
        supabase.from('completed_rides').select('*').eq('route_id', route.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('route_reviews').select('*').eq('route_id', route.id).order('created_at', { ascending: false }),
        supabase.from('ride_photos').select('*').eq('route_id', route.id),
      ])

      if (cancelled) return

      setCompletedRide(ridesResult.data?.[0] || null)
      setReviews(reviewsResult.data || [])
      // Each ride_photos row stores a jsonb array of URLs for one save; flatten across rows.
      const flatPhotos = (photosResult.data || []).flatMap((row) => (Array.isArray(row.photo_urls) ? row.photo_urls : []))
      setPhotos(flatPhotos)
      setLoading(false)
    }

    fetchDetail()
    return () => {
      cancelled = true
    }
  }, [route?.id])

  const elevationProfile = useMemo(() => buildElevationProfile(completedRide?.track_points), [completedRide])

  // completed_rides doesn't have its own max_elevation column — derive it
  // from the same track_points the elevation chart is already built from.
  const maxElevation = elevationProfile.length > 0
    ? Math.max(...elevationProfile.map((point) => point.elevation))
    : null

  if (!route) return null

  return (
    <div className="bottom-sheet-details">
      <button type="button" className="trail-back-button" onClick={onBack}>
        ← Back to Routes
      </button>

      <div className="details-header">
        <h3>{route.name}</h3>
      </div>
      <p className="trail-description" style={{ margin: 0 }}>{formatDate(route.created_at)}</p>

      {loading ? (
        <div className="user-routes-state">
          <div className="user-routes-loading">Loading ride details...</div>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Distance</span>
              <span className="stat-value">
                {route.distance_km != null ? `${Number(route.distance_km).toFixed(1)} km` : '—'}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Duration</span>
              <span className="stat-value">{formatDuration(completedRide?.duration_sec) || '—'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Elevation Gain</span>
              <span className="stat-value">
                {completedRide?.elevation_gain != null ? `${Math.round(completedRide.elevation_gain)} m` : '—'}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Max Elevation</span>
              <span className="stat-value">{maxElevation != null ? `${Math.round(maxElevation)} m` : '—'}</span>
            </div>
          </div>

          {elevationProfile.length > 0 && (
            <div className="elevation-chart-container">
              <h4>Elevation Profile</h4>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={elevationProfile}>
                  <defs>
                    <linearGradient id="userRouteElevationGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLOR} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={CHART_COLOR} stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="distance"
                    stroke="#94a3b8"
                    label={{ value: 'Distance (km)', position: 'insideBottomRight', offset: -5 }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    label={{ value: 'Elevation (m)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f3460', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#f1f5f9' }}
                    formatter={(value) => [Number(value).toFixed(0) + ' m', 'Elevation']}
                  />
                  <Area
                    type="monotone"
                    dataKey="elevation"
                    stroke={CHART_COLOR}
                    fillOpacity={1}
                    fill="url(#userRouteElevationGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <ReviewsSection reviews={reviews} title="Reviews" />

          <PhotoGallery photos={photos} onPhotoClick={setFullscreenPhoto} title="Photos" />
        </>
      )}

      <PhotoFullscreenOverlay photoUrl={fullscreenPhoto} onClose={() => setFullscreenPhoto(null)} />
    </div>
  )
}
