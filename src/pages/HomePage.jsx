import { Link } from 'react-router-dom'
import { MapContainer, TileLayer } from 'react-leaflet'
import '../App.css'

export default function HomePage() {
  return (
    <div className="page home-page">
      <header className="hero">
        <h1>🚴 Brač Bike Trails</h1>
        <p className="tagline">Discover routes, track your rides, and explore Brač by bike.</p>
      </header>

      <div className="home-grid">
        <div className="preview-card">
          <MapContainer center={[43.307, 16.635]} zoom={10} style={{ height: 300, borderRadius: 12 }} scrollWheelZoom={false} dragging={false} doubleClickZoom={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap contributors' />
          </MapContainer>
        </div>

        <div className="nav-cards">
          <Link to="/trails" className="nav-card">🚵<span>Explore Trails</span></Link>
          <Link to="/plan" className="nav-card">📍<span>Plan a Route</span></Link>
          <Link to="/routes" className="nav-card">🗂️<span>My Routes</span></Link>
          <Link to="/tips" className="nav-card">💡<span>Tips & Tricks</span></Link>
          <Link to="/book" className="nav-card">🚲<span>Book a Bike</span></Link>
        </div>
      </div>
    </div>
  )
}
