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
    <>
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
            <div className="tab-icon" aria-hidden="true">{link.icon}</div>
            <div className="tab-label">{link.label}</div>
          </NavLink>
        ))}
      </nav>
    </>
  )
}