import { Link } from 'react-router-dom'
import './HomePage.css'

export default function HomePage() {
  return (
    <div className="home-page">
      <div className="home-logo-container">
        <img
          src="/brač by bike4.svg"
          alt="Brač by Bike"
          className="home-main-logo"
        />
      </div>

      <div className="home-buttons">
        <Link to="/trails" className="home-button">
          Explore Routes
        </Link>
        <Link to="/tips" className="home-button">
          Local Tips
        </Link>
        <Link to="/book" className="home-button">
          Book a Bike
        </Link>
      </div>

      <div className="home-powered-by">
        <span className="home-powered-text">Powered by:</span>
        <a href="https://r-and-r.eu" target="_blank" rel="noopener noreferrer">
          <img
            src="/logorrwhite.svg"
            alt="R&R"
            className="home-company-logo"
          />
        </a>
      </div>
    </div>
  )
}