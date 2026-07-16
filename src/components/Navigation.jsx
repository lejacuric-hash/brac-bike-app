import { NavLink, useLocation } from 'react-router-dom'
import './Navigation.css'

// Updated links structure using your brand-new SVG files
const links = [
  { to: '/', label: 'Home', iconSrc: '/home.svg' },
  { to: '/trails', label: 'Trails', iconSrc: '/trails.svg' },
  { to: '/tips', label: 'Tips', iconSrc: '/tips.svg' },
  { to: '/book', label: 'Book', iconSrc: '/book-a-bike.svg' },
]

export default function Navigation() {
  const location = useLocation()

  // Hide navigation on the landing/home screen
  if (location.pathname === '/') {
    return null
  }

  return (
    <nav className="bottom-tabbar" aria-label="Bottom navigation">
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} className="tab-link">
          <div className="tab-icon">
            <img 
              src={l.iconSrc} 
              alt="" 
              style={{ 
                width: '24px', 
                height: '24px', 
                display: 'block', 
                margin: '0 auto' 
              }} 
            />
          </div>
          <div className="tab-label">{l.label}</div>
        </NavLink>
      ))}
    </nav>
  )
}