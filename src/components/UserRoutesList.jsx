import { useEffect, useState } from 'react'
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

function UserRoutesList({ activeTab, onRouteSelect, selectedRouteId }) {
  const [routes, setRoutes] = useState([])
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
      setLoading(false)
    }

    fetchRoutes()
  }, [activeTab])

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
          <button
            className="show-button"
            type="button"
            onClick={() => onRouteSelect(route)}
          >
            Show on Map
          </button>
        </div>
      ))}
    </div>
  )
}

export default UserRoutesList
