import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useRide } from '../contexts/RideContext'
import './Navigation.css'

const links = [
  { to: '/', label: 'Home', icon: '/home.svg' },
  { to: '/trails', label: 'Trails', icon: '/trails.svg' },
  { to: '/tips', label: 'Tips', icon: '/tips.svg' },
  { to: '/book', label: 'Book', icon: '/book-a-bike.svg' },
]

function formatElapsed(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const { activeRecording, totalDistance, elapsedSeconds } = useRide()

  // Hide navigation on landing page
  if (location.pathname === '/') {
    return null
  }

  return (
    <>
      {activeRecording && location.pathname !== '/trails' && (
        <div className="recording-status-bar" onClick={() => navigate('/trails')}>
          <div className="recording-dot" />
          <span>Recording · {totalDistance.toFixed(2)} km · {formatElapsed(elapsedSeconds)}</span>
          <span className="recording-tap-hint">tap to return →</span>
        </div>
      )}

      <nav className="top-navbar" aria-label="Main navigation">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <nav className="bottom-tabbar" aria-label="Bottom navigation">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}
          >
            <div className="tab-icon" aria-hidden="true">
              <img src={link.icon} alt={`${link.label} icon`} className="nav-svg-icon" />
            </div>
            <div className="tab-label">{link.label}</div>
          </NavLink>
        ))}
      </nav>
    </>
  )
}