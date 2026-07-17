import React, { useRef, useState, useCallback, useMemo } from 'react'
import PropTypes from 'prop-types'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import UserRoutesList from './UserRoutesList'
import './BottomSheet.css'

const difficultyColors = {
  easy: '#4ade80',
  medium: '#facc15',
  hard: '#f97316',
}

const difficultyOptions = [
  { id: 'all', label: 'All' },
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
]

function findNearestSnap(height, snapPositions) {
  return Object.entries(snapPositions).reduce((prev, curr) =>
    Math.abs(curr[1] - height) < Math.abs(prev[1] - height) ? curr : prev
  )
}

function BottomSheet({
  trails = [],
  selectedTrail = null,
  trailStats = {},
  onTrailClick,
  onBackToRoutes,
  onChartHover,
  activeTab: activeTabProp,
  onTabChange,
  planNewContent,
  onRouteSelect,
  selectedRouteId,
  routeFeedbackRefreshKey,
  trailCommunityData,

}) {
  const [internalActiveTab, setInternalActiveTab] = useState('routes')
  const activeTab = activeTabProp || internalActiveTab
  const setActiveTab = (tab) => {
    if (typeof onTabChange === 'function') {
      onTabChange(tab)
    }
    if (activeTabProp === undefined) {
      setInternalActiveTab(tab)
    }
  }

  // Mobile shows a fixed bottom tab bar (see Navigation.css) that sits on top of
  // (higher z-index than) this sheet. Without this offset the sheet's own bottom
  // edge is covered by the tab bar and its lowest content can never be scrolled
  // into view. Track viewport size live so rotating the device keeps this correct.
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 600,
  }))

  React.useEffect(() => {
    const handleResize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const navBarHeight = viewportSize.width <= 767 ? 64 : 0
  const availableHeight = Math.max(viewportSize.height - navBarHeight, 0)

  const snapPositions = useMemo(() => ({
    COLLAPSED: 80,
    HALF: availableHeight * 0.5,
    FULL: availableHeight * 0.95,
  }), [availableHeight])

  const [currentHeight, setCurrentHeight] = useState(snapPositions.COLLAPSED)
  const [snapKey, setSnapKey] = useState('COLLAPSED')
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(0)
  const [dragStartHeight, setDragStartHeight] = useState(snapPositions.COLLAPSED)
  const [filter, setFilter] = useState('all')
  const sheetRef = useRef(null)
  const dragHandleRef = useRef(null)

  const filteredTrails = useMemo(() => {
    if (filter === 'all') {
      return trails
    }
    return trails.filter((trail) => trail.difficulty === filter)
  }, [trails, filter])

  const currentTrail = trails.find((t) => t.filename === selectedTrail)
  const stats = selectedTrail && trailStats ? trailStats[selectedTrail] : null

  const handleMouseDown = (e) => {
    setIsDragging(true)
    setDragStart(e.clientY)
    setDragStartHeight(currentHeight)
  }

  const handleTouchStart = (e) => {
    setIsDragging(true)
    setDragStart(e.touches[0].clientY)
    setDragStartHeight(currentHeight)
  }

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging) return
      const currentY = e.clientY
      const delta = dragStart - currentY
      let newHeight = dragStartHeight + delta
      newHeight = Math.max(snapPositions.COLLAPSED, Math.min(newHeight, snapPositions.FULL))
      setCurrentHeight(newHeight)
    },
    [isDragging, dragStart, dragStartHeight, snapPositions]
  )

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)

    const [nearestKey, nearestValue] = findNearestSnap(currentHeight, snapPositions)
    setSnapKey(nearestKey)
    setCurrentHeight(nearestValue)
  }, [isDragging, currentHeight, snapPositions])

  const handleTouchMove = useCallback(
    (e) => {
      if (!isDragging) return
      e.preventDefault()
      const currentY = e.touches[0].clientY
      const delta = dragStart - currentY
      let newHeight = dragStartHeight + delta
      newHeight = Math.max(snapPositions.COLLAPSED, Math.min(newHeight, snapPositions.FULL))
      setCurrentHeight(newHeight)
    },
    [isDragging, dragStart, dragStartHeight, snapPositions]
  )

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)

    const [nearestKey, nearestValue] = findNearestSnap(currentHeight, snapPositions)
    setSnapKey(nearestKey)
    setCurrentHeight(nearestValue)
  }, [isDragging, currentHeight, snapPositions])

  const handleTrailClick = (trail) => {
    onTrailClick?.(trail)
    setActiveTab('routes')
    setSnapKey('HALF')
    setCurrentHeight(snapPositions.HALF)
  }

  const handleBackToList = () => {
    onBackToRoutes?.()
    setActiveTab('routes')
    setSnapKey('HALF')
    setCurrentHeight(snapPositions.HALF)
  }

  const handleChartMouseMove = (state) => {
    if (state && state.activeTooltipIndex != null && stats?.elevationData) {
      const index = parseInt(state.activeTooltipIndex, 10)
      const point = stats.elevationData[index]
      if (point && point.lat != null && point.lng != null) {
        onChartHover?.(point)
        return
      }
    }
    onChartHover?.(null)
  }

  const handleChartMouseLeave = () => {
    onChartHover?.(null)
  }

  React.useEffect(() => {
    if (isDragging) return
    setCurrentHeight(snapPositions[snapKey])
  }, [snapPositions, snapKey, isDragging])

  React.useEffect(() => {
    if (!isDragging) return

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd])

  const estimatedTime = (() => {
    if (!currentTrail || !stats) return ''
    const speedMap = { easy: 15, medium: 12, hard: 9 }
    const speed = speedMap[currentTrail.difficulty] || 12
    const hours = (stats.distance || 0) / speed
    const mins = Math.round(hours * 60)
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  })()

  const chartColor = currentTrail ? difficultyColors[currentTrail.difficulty] || difficultyColors.easy : '#4ade80'

  const renderRoutesList = () => (
    <div className="bottom-sheet-routes">
      <div className="filter-row">
        {difficultyOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`filter-button ${filter === option.id ? 'active' : ''}`}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="trail-list">
        {filteredTrails.length === 0 ? (
          <div className="empty-state">No trails available.</div>
        ) : (
          filteredTrails.map((trail) => (
            <div
              className={`trail-card ${selectedTrail === trail.filename ? 'selected' : ''}`}
              key={trail.filename}
            >
              <div className="trail-card-header">
                <strong>{trail.name}</strong>
                <span
                  className="difficulty-badge"
                  style={{ backgroundColor: difficultyColors[trail.difficulty] || difficultyColors.easy }}
                >
                  {trail.difficulty}
                </span>
              </div>
              <p className="trail-description">{trail.description}</p>
              <div className="trail-start">
                <span className="start-icon">📍</span>
                <span>{trail.startLocation}</span>
              </div>
              <button
                className="show-button"
                type="button"
                onClick={() => handleTrailClick(trail)}
              >
                Show on Map
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )

  const renderTrailDetails = () => {
    if (!currentTrail || !stats) return null

    return (
      <div className="bottom-sheet-details">
        <button type="button" className="trail-back-button" onClick={handleBackToList}>
          ← Back to All Trails
        </button>
        <div className="details-header">
          <h3>{currentTrail.name}</h3>
          <span
            className="details-difficulty-badge"
            style={{ backgroundColor: chartColor }}
          >
            {currentTrail.difficulty}
          </span>
        </div>

        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Distance</span>
            <span className="stat-value">{(stats.distance || 0).toFixed(1)} km</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Elevation Gain</span>
            <span className="stat-value">{Math.round(stats.elevationGain || 0)} m</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Elevation Loss</span>
            <span className="stat-value">{Math.round(stats.elevationLoss || 0)} m</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Highest Point</span>
            <span className="stat-value">{Math.round(stats.elevationMax || 0)} m</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Lowest Point</span>
            <span className="stat-value">{Math.round(stats.elevationMin || 0)} m</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Estimated Time</span>
            <span className="stat-value">{estimatedTime}</span>
          </div>
        </div>

        {currentTrail.roadType && currentTrail.roadType.length > 0 && (
          <div className="road-types">
            <label>Road Types:</label>
            <div className="badge-group">
              {currentTrail.roadType.map((type) => (
                <span key={type} className="road-type-badge">
                  {type}
                </span>
              ))}
            </div>
          </div>
        )}

        {stats.elevationData && stats.elevationData.length > 0 && (
          <div className="elevation-chart-container">
            <h4>Elevation Profile</h4>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart
                data={stats.elevationData}
                onMouseMove={handleChartMouseMove}
                onMouseLeave={handleChartMouseLeave}
              >
                <defs>
                  <linearGradient id="colorElevation" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0.1} />
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
                  formatter={(value) => [value.toFixed(0) + ' m', 'Elevation']}
                />
                <Area
                  type="monotone"
                  dataKey="elevation"
                  stroke={chartColor}
                  fillOpacity={1}
                  fill="url(#colorElevation)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="elevation-chart-container" style={{ marginTop: '10px' }}>
          <h4>Community Feedback</h4>
          {trailCommunityData?.loading ? (
            <p className="trail-description">Syncing route and loading reviews...</p>
          ) : (
            <>
              {trailCommunityData?.error && (
                <p className="trail-description" style={{ color: '#fca5a5' }}>{trailCommunityData.error}</p>
              )}
              <p className="trail-description" style={{ marginBottom: '6px' }}>
                {trailCommunityData?.averageRating != null
                  ? `⭐ ${trailCommunityData.averageRating.toFixed(1)} / 5`
                  : '⭐ No ratings yet'}
                {' · '}
                {trailCommunityData?.completionCount || 0} completions
              </p>
              {trailCommunityData?.reviews?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {trailCommunityData.reviews.slice(0, 5).map((review) => (
                    <div
                      key={review.id}
                      style={{
                        backgroundColor: '#11203b',
                        border: '1px solid #1e3a5f',
                        borderRadius: '8px',
                        padding: '8px',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div style={{ color: '#facc15', marginBottom: '4px' }}>
                        {'★'.repeat(Math.max(0, Number(review.rating) || 0))}
                      </div>
                      <div style={{ color: '#e2e8f0' }}>{review.comment || 'No comment'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="trail-description">No public reviews yet.</p>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'routes':
        return selectedTrail && currentTrail ? renderTrailDetails() : renderRoutesList()
     case 'userRoutes':
  return (
    <UserRoutesList
      activeTab={activeTab}
      onRouteSelect={onRouteSelect}
      selectedRouteId={selectedRouteId}
        refreshKey={routeFeedbackRefreshKey}
    />
  )
      case 'planNew':
        return planNewContent || (
          <div className="bottom-sheet-placeholder">
            <p>Route planner coming soon</p>
          </div>
        )
      default:
        return renderRoutesList()
    }
  }

  return (
    <div
      ref={sheetRef}
      className="bottom-sheet"
      style={{
        height: `${currentHeight}px`,
        bottom: `${navBarHeight}px`,
        transition: isDragging ? 'none' : 'height 0.3s ease-out',
      }}
    >
      <div
        className="bottom-sheet-handle-container"
        onMouseDown={handleMouseDown}
        onTouchStart={(e) => {
          e.preventDefault()
          handleTouchStart(e)
        }}
      >
        <div className="bottom-sheet-handle" ref={dragHandleRef} />
      </div>

      <div className="bottom-sheet-tabs">
        <button
          type="button"
          className={`sheet-tab ${activeTab === 'routes' ? 'active' : ''}`}
          onClick={() => setActiveTab('routes')}
        >
          Routes
        </button>
        <button
          type="button"
          className={`sheet-tab ${activeTab === 'userRoutes' ? 'active' : ''}`}
          onClick={() => setActiveTab('userRoutes')}
        >
          User Routes
        </button>
        <button
          type="button"
          className={`sheet-tab ${activeTab === 'planNew' ? 'active' : ''}`}
          onClick={() => setActiveTab('planNew')}
        >
          Plan New
        </button>
      </div>

      <div className="bottom-sheet-content">
        {renderTabContent()}
      </div>
    </div>
  )
}

BottomSheet.propTypes = {
  trails: PropTypes.arrayOf(
    PropTypes.shape({
      filename: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      difficulty: PropTypes.string,
      description: PropTypes.string,
      startLocation: PropTypes.string,
      roadType: PropTypes.arrayOf(PropTypes.string),
    })
  ),
  selectedTrail: PropTypes.string,
  trailStats: PropTypes.object,
  onTrailClick: PropTypes.func,
  onBackToRoutes: PropTypes.func,
  onChartHover: PropTypes.func,
  onRouteSelect: PropTypes.func,
  activeTab: PropTypes.oneOf(['routes', 'userRoutes', 'planNew']),
  onTabChange: PropTypes.func,
  planNewContent: PropTypes.node,
  routeFeedbackRefreshKey: PropTypes.number,
  trailCommunityData: PropTypes.shape({
    routeId: PropTypes.string,
    loading: PropTypes.bool,
    error: PropTypes.string,
    averageRating: PropTypes.number,
    completionCount: PropTypes.number,
    reviews: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        rating: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        comment: PropTypes.string,
      })
    ),
  }),
}

export default BottomSheet