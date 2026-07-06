import { useMemo, useState } from 'react'
import './TipsPage.css'

const menuItems = [
  'Plan by Weather Forecast',
  'Places to Visit',
  'Gastro Corner',
  'Connect with Local Family Farms',
  'Events',
]

const placesData = [
  {
    title: 'Zlatni Rat',
    description: 'A striking pebble beach with crystal-clear water and perfect sunset views.',
    emoji: '🏖️',
  },
  {
    title: 'Blaca Hermitage',
    description: 'A remarkable historic retreat tucked into the island hills with dramatic scenery.',
    emoji: '⛰️',
  },
]

const gastroData = [
  {
    title: 'Seafood Taverns',
    description: 'Enjoy fresh island dishes by the shore with local olive oil and herbs.',
    emoji: '🍽️',
  },
  {
    title: 'Coffee & Cake Stops',
    description: 'Pause for a relaxed break between rides with pastries and espresso.',
    emoji: '☕',
  },
]

const farmsData = [
  {
    title: 'Olive Farm Visits',
    description: 'Meet local producers and discover traditional island farming practices.',
    emoji: '🌿',
  },
  {
    title: 'Cheese & Honey Tastings',
    description: 'Sample island favorites while learning about family-run production.',
    emoji: '🧀',
  },
]

const eventsData = [
  {
    title: 'Summer Night Markets',
    description: 'Enjoy live music, local crafts, and evening gatherings along the coast.',
    emoji: '🎶',
  },
  {
    title: 'Cycling Meetups',
    description: 'Join friendly group rides that blend scenic routes with local culture.',
    emoji: '🚲',
  },
]

function SectionView({ title, description, items, onBack }) {
  return (
    <div className="tips-subview">
      <button type="button" className="tips-back-button" onClick={onBack}>
        ← Back to Tips
      </button>

      <div className="tips-subview-header">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="card-list">
        {items.map((item) => (
          <article key={item.title} className="tips-card">
            <div className="tips-card-media" aria-hidden="true">
              {item.emoji}
            </div>
            <div className="tips-card-body">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

export default function TipsPage() {
  const [currentView, setCurrentView] = useState('menu')

  const weather = useMemo(
    () => ({
      location: 'Vidova Gora',
      temperature: '24°C',
      windDirection: 'North',
      windLabel: 'Bura',
      summary: 'Clear skies and a fresh breeze',
    }),
    []
  )

  const weatherRecommendation =
    weather.windDirection === 'North' || weather.windLabel === 'Bura'
      ? '⚠️ Strong North wind detected! We highly recommend cycling on the South side of Brač today (e.g., Bol or Murvica trails) for mountain protection.'
      : '🌤️ The breeze is gentle today, so the island routes remain very comfortable for a relaxed ride.'

  const sectionContent = {
    'Places to Visit': {
      title: 'Places to Visit',
      description: 'Discover scenic highlights that pair beautifully with a relaxed island ride.',
      items: placesData,
    },
    'Gastro Corner': {
      title: 'Gastro Corner',
      description: 'Find the best island bites for a memorable rest stop after your route.',
      items: gastroData,
    },
    'Connect with Local Family Farms': {
      title: 'Connect with Local Family Farms',
      description: 'Meet producers and explore Brač through its food and traditions.',
      items: farmsData,
    },
    Events: {
      title: 'Events',
      description: 'Check out cultural happenings and casual local gatherings nearby.',
      items: eventsData,
    },
  }

  return (
    <div className="tips-page">
      <div className="tips-page-shell">
        {currentView === 'menu' ? (
          <>
            <img
              src="/brač by bike4.svg"
              alt="Brač by Bike logo"
              className="tips-logo"
            />

            <div className="tips-menu">
              {menuItems.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="tips-menu-button"
                  onClick={() => setCurrentView(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </>
        ) : currentView === 'Plan by Weather Forecast' ? (
          <div className="tips-subview">
            <button type="button" className="tips-back-button" onClick={() => setCurrentView('menu')}>
              ← Back to Tips
            </button>

            <div className="tips-subview-header">
              <h2>Plan by Weather Forecast</h2>
              <p>Use this quick snapshot to choose a safer, more comfortable ride.</p>
            </div>

            <div className="weather-card">
              <span className="weather-badge">Live forecast</span>
              <div className="weather-main">
                <div>
                  <div className="weather-location">{weather.location}</div>
                  <div className="weather-meta">{weather.summary}</div>
                </div>
                <div className="weather-temp">{weather.temperature}</div>
              </div>
              <div className="weather-meta">Wind: {weather.windDirection} ({weather.windLabel})</div>
            </div>

            <div className="recommendation-box">{weatherRecommendation}</div>
          </div>
        ) : (
          <SectionView
            title={sectionContent[currentView].title}
            description={sectionContent[currentView].description}
            items={sectionContent[currentView].items}
            onBack={() => setCurrentView('menu')}
          />
        )}
      </div>
    </div>
  )
}
