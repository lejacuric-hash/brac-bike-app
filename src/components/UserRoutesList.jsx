import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

function timeAgo(dateString) {
  const now = new Date()
  const date = new Date(dateString)
  const seconds = Math.floor((now - date) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`
  const months = Math.floor(days / 30)
  return `${months} month${months !== 1 ? 's' : ''} ago`
}

function UserRoutesList({ activeTab, onRouteSelect, selectedRouteId, refreshKey = 0 }) {
  const [routes, setRoutes] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (activeTab !== 'userRoutes') return

    const fetchRoutes = async () => {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('user_routes')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) {
        setError('Could not load routes. Please try again.')
      } else {
        setRoutes(data || [])
      }

      const { data: reviewData, error: reviewFetchError } = await supabase
        .from('route_reviews')
        .select('route_id, rating, comment')

      if (reviewFetchError) {
        setReviews([])
      } else {
        setReviews(reviewData || [])
      }
      setLoading(false)
    }

    fetchRoutes()
  }, [activeTab, refreshKey])

  const reviewStatsByRouteId = useMemo(() => {
    return reviews.reduce((acc, review) => {
      const key = String(review.route_id ?? '')
      if (!key) return acc

      if (!acc[key]) {
        acc[key] = {
          totalRating: 0,
          ratingCount: 0,
          commentCount: 0,
        }
      }

      if (Number.isFinite(review.rating)) {
        acc[key].totalRating += review.rating
        acc[key].ratingCount += 1
      }

      if (review.comment && review.comment.trim().length > 0) {
        acc[key].commentCount += 1
      }

      return acc
    }, {})
  }, [reviews])

  if (loading) {
    return (
      <div className="user-routes-state">
        <div className="user-routes-loading">Loading routes...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="user-routes-state">
        <div className="user-routes-error">{error}</div>
      </div>
    )
  }

  if (routes.length === 0) {
    return (
      <div className="user-routes-state">
        <div className="user-routes-empty">
          No routes yet — be the first to record one! 🚴
        </div>
      </div>
    )
  }

  return (
    <div className="user-routes-list">
      {routes.map((route) => (
        (() => {
          const routeStats = reviewStatsByRouteId[String(route.id)] || { totalRating: 0, ratingCount: 0, commentCount: 0 }
          const averageRating = routeStats.ratingCount > 0
            ? routeStats.totalRating / routeStats.ratingCount
            : null

          return (
            <div
              key={route.id}
              className={`trail-card ${selectedRouteId === route.id ? 'selected' : ''}`}
            >
              <div className="trail-card-header">
                <strong>{route.name}</strong>
                <span className="user-route-badge">👤 Community</span>
              </div>
              <div className="trail-description">
                {route.distance_km ? `${Number(route.distance_km).toFixed(1)} km` : 'Distance unknown'}
                {' · '}
                {timeAgo(route.created_at)}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '8px' }}>
                {averageRating != null ? `⭐ ${averageRating.toFixed(1)} / 5` : '⭐ No ratings yet'}
                {' · '}
                {routeStats.commentCount} community comment{routeStats.commentCount === 1 ? '' : 's'}
              </div>
              <button
                className="show-button"
                type="button"
                onClick={() => onRouteSelect(route)}
              >
                Show on Map
              </button>
            </div>
          )
        })()
      ))}
    </div>
  )
}

export default UserRoutesList
