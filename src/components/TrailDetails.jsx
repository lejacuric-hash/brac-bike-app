import PropTypes from 'prop-types'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const difficultyColors = {
  easy: '#4ade80',
  medium: '#facc15',
  hard: '#f97316',
}

function TrailDetails({ trail, trailStats, onBack, onChartHover, onClose }) {
  if (!trail || !trailStats) {
    return null
  }

  const stats = trailStats[trail.filename]
  if (!stats) {
    return null
  }

  const estimatedTime = (() => {
    const speedMap = { easy: 15, medium: 12, hard: 9 }
    const speed = speedMap[trail.difficulty] || 12
    const hours = (stats.distance || 0) / speed
    const mins = Math.round(hours * 60)
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  })()

  const chartColor = difficultyColors[trail.difficulty] || difficultyColors.easy

  const handleChartMouseMove = (state) => {
    if (state && state.activeTooltipIndex != null && stats.elevationData) {
      const index = parseInt(state.activeTooltipIndex, 10)
      const point = stats.elevationData[index]
      if (point && point.lat != null && point.lng != null) {
        onChartHover(point)
        return
      }
    }
    onChartHover(null)
  }

  const handleChartMouseLeave = () => {
    onChartHover(null)
  }

  return (
    <div className="trail-details">
      {onClose && (
        <button type="button" className="mobile-close-btn" onClick={onClose}>
          ✕
        </button>
      )}
      <button type="button" className="trail-back-button" onClick={onBack}>
        ← Back to All Trails
      </button>
      <div className="details-header">
        <h3>{trail.name}</h3>
        <span
          className="details-difficulty-badge"
          style={{ backgroundColor: chartColor }}
        >
          {trail.difficulty}
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

      {trail.roadType && trail.roadType.length > 0 && (
        <div className="road-types">
          <label>Road Types:</label>
          <div className="badge-group">
            {trail.roadType.map((type) => (
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
    </div>
  )
}

TrailDetails.propTypes = {
  trail: PropTypes.shape({
    filename: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    difficulty: PropTypes.string.isRequired,
    roadType: PropTypes.arrayOf(PropTypes.string),
  }),
  trailStats: PropTypes.objectOf(
    PropTypes.shape({
      distance: PropTypes.number,
      elevationGain: PropTypes.number,
      elevationLoss: PropTypes.number,
      elevationMax: PropTypes.number,
      elevationMin: PropTypes.number,
      elevationData: PropTypes.arrayOf(
        PropTypes.shape({
          distance: PropTypes.number,
          elevation: PropTypes.number,
          lat: PropTypes.number,
          lng: PropTypes.number,
        }),
      ),
    }),
  ),
  onBack: PropTypes.func.isRequired,
  onChartHover: PropTypes.func.isRequired,
  onClose: PropTypes.func,
}

export default TrailDetails
