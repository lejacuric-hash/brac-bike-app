import PropTypes from 'prop-types'
import './NavigationHud.css'

function NavigationHud({
  loading,
  distanceRemainingKm,
  progressFraction,
  relativeBearingDeg,
  activeHazardWarning,
  onDismissHazardWarning,
  mapRotationDeg,
  isNorthUpLocked,
  onToggleNorthUpLock,
  onExit,
  routeName,
}) {
  const arrowRotation = relativeBearingDeg ?? 0
  const compassRotation = -(mapRotationDeg ?? 0)

  return (
    <div className="nav-hud">
      <button type="button" className="nav-hud-exit" onClick={onExit} aria-label="Exit navigation">
        ✕
      </button>

      <button
        type="button"
        className={`nav-hud-compass ${isNorthUpLocked ? 'locked' : ''}`}
        onClick={onToggleNorthUpLock}
        title={isNorthUpLocked ? 'Resume heading-up rotation' : 'Lock map to north-up'}
        aria-label="Toggle north-up lock"
      >
        <div className="nav-hud-compass-needle" style={{ transform: `rotate(${compassRotation}deg)` }}>
          N
        </div>
      </button>

      <div className="nav-hud-pill">
        {loading ? (
          <div className="nav-hud-loading">Finding your location…</div>
        ) : (
          <>
            <div className="nav-hud-arrow" style={{ transform: `rotate(${arrowRotation}deg)` }}>
              ↑
            </div>
            <div className="nav-hud-info">
              {routeName && <div className="nav-hud-route-name">{routeName}</div>}
              <div className="nav-hud-distance">
                {distanceRemainingKm != null ? `${distanceRemainingKm.toFixed(2)} km to go` : '—'}
              </div>
              <div className="nav-hud-progress-track">
                <div
                  className="nav-hud-progress-fill"
                  style={{ width: `${Math.round((progressFraction ?? 0) * 100)}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {activeHazardWarning && (
        <div className="nav-hud-hazard-banner">
          <span className="nav-hud-hazard-icon">⚠️</span>
          <div className="nav-hud-hazard-text">
            <strong>{activeHazardWarning.type || 'Road hazard'}</strong>
            {activeHazardWarning.description && <div>{activeHazardWarning.description}</div>}
          </div>
          <button
            type="button"
            className="nav-hud-hazard-dismiss"
            onClick={onDismissHazardWarning}
            aria-label="Dismiss warning"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}

NavigationHud.propTypes = {
  loading: PropTypes.bool,
  distanceRemainingKm: PropTypes.number,
  progressFraction: PropTypes.number,
  relativeBearingDeg: PropTypes.number,
  activeHazardWarning: PropTypes.shape({
    type: PropTypes.string,
    description: PropTypes.string,
  }),
  onDismissHazardWarning: PropTypes.func,
  mapRotationDeg: PropTypes.number,
  isNorthUpLocked: PropTypes.bool,
  onToggleNorthUpLock: PropTypes.func,
  onExit: PropTypes.func,
  routeName: PropTypes.string,
}

export default NavigationHud
