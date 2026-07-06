import { NavLink } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import './Navigation.css'

const links = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/trails', label: 'Trails', icon: '🚵' },
  { to: '/plan', label: 'Plan', icon: '📍' },
  { to: '/tips', label: 'Tips', icon: '💡' },
  { to: '/book', label: 'Book', icon: '🚲' },
]

export default function Navigation() {
  return (
    <>
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
