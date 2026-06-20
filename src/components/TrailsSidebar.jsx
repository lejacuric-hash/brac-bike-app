import { useMemo, useState } from 'react'
import PropTypes from 'prop-types'

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

function TrailsSidebar({ trails = [], onTrailClick, onShowAll, selectedTrail = null, sidebarOpen = false, onClose }) {
  const [filter, setFilter] = useState('all')

  const filteredTrails = useMemo(() => {
    if (filter === 'all') {
      return trails
    }
    return trails.filter((trail) => trail.difficulty === filter)
  }, [trails, filter])

  return (
    <aside className="sidebar">
      {onClose && (
        <button type="button" className="mobile-close-btn" onClick={onClose}>
          ✕
        </button>
      )}
      <h2 className="sidebar-title">Trails</h2>

      {selectedTrail && (
        <button type="button" className="show-all-btn" onClick={onShowAll}>
          ← Show All Trails
        </button>
      )}

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
                onClick={() => {
                  onTrailClick(trail)
                  if (typeof onClose === 'function' && typeof window !== 'undefined' && window.innerWidth < 768) {
                    onClose()
                  }
                }}
              >
                Show on Map
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}

TrailsSidebar.propTypes = {
  trails: PropTypes.arrayOf(
    PropTypes.shape({
      filename: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      difficulty: PropTypes.string.isRequired,
      description: PropTypes.string,
      startLocation: PropTypes.string,
    }),
  ),
  onTrailClick: PropTypes.func.isRequired,
  onShowAll: PropTypes.func.isRequired,
  selectedTrail: PropTypes.string,
  sidebarOpen: PropTypes.bool,
  onClose: PropTypes.func,
}

export default TrailsSidebar
