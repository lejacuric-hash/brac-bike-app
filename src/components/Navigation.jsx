import { NavLink, useLocation } from 'react-router-dom'
import './Navigation.css'

const links = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/trails', label: 'Trails', icon: '🚵' },
  { to: '/tips', label: 'Tips', icon: '💡' },
  { to: '/book', label: 'Book', icon: '🚲' },
]

export default function Navigation() {
  const location = useLocation()

  if (location.pathname === '/') {
    return null
  }

  return (
    <nav className="bottom-tabbar" aria-label="Bottom navigation">
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} className="tab-link">
          <div className="tab-icon">{l.icon}</div>
          <div className="tab-label">{l.label}</div>
        </NavLink>
      ))}
    </nav>
  )
}
