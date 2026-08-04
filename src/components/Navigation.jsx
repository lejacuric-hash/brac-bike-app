import { NavLink, useLocation } from 'react-router-dom'
import './Navigation.css'

const links = [
  { to: '/', label: 'Home', icon: '/home.svg' },
  { to: '/trails', label: 'Trails', icon: '/trails.svg' },
  { to: '/tips', label: 'Tips', icon: '/tips.svg' },
  { to: '/book', label: 'Book', icon: '/book-a-bike.svg' },
]

export default function Navigation() {
  const location = useLocation()

  // Hide navigation on landing page
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