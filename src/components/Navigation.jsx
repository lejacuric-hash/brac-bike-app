import { NavLink } from 'react-router-dom'
import './Navigation.css'

const links = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/trails', label: 'Trails', icon: '🚵' },
  { to: '/plan', label: 'Plan', icon: '📍' },
  { to: '/routes', label: 'Routes', icon: '🗂️' },
  { to: '/tips', label: 'Tips', icon: '💡' },
  { to: '/book', label: 'Book', icon: '🚲' },
]

export default function Navigation() {
  return (
    <>
      <header className="top-nav">
        <div className="nav-left">🚴 Brač Bike Trails</div>
        <nav className="nav-links">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className="nav-link">
              {l.icon} {l.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <nav className="bottom-tabbar">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className="tab-link">
            <div className="tab-icon">{l.icon}</div>
            <div className="tab-label">{l.label}</div>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
