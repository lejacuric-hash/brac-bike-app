import { useMemo, useState } from 'react'
import './TipsPage.css'

const menuItems = [
  'Plan by Weather Forecast',
  'Places to Visit',
  'Gastro Corner',
  'Connect with Local Family Farms',
  'Events',
]

const BRAC_LOCATIONS = [
  // --- High Elevation / Interior Hubs (Crazy wind & temperature drops) ---
  { id: 'vidova-gora', name: 'Vidova Gora', lat: 43.2803, lng: 16.6375, regionalTip: 'Highest point on the island. Can be 5°C colder than the coast. Wind sweeps hard across the ridge!' },
  { id: 'praznice', name: 'Pražnice', lat: 43.3444, lng: 16.6789, regionalTip: 'High inland plateau. Heavily exposed to Bura (North) and Jugo (South). Bring layers!' },
  { id: 'gornji-humac', name: 'Gornji Humac', lat: 43.3156, lng: 16.7214, regionalTip: 'Crucial high crossroads. Excellent base for interior gravel tracking, but gets freezing winter/evening drafts.' },
  { id: 'nerezisca', name: 'Nerežišća', lat: 43.3314, lng: 16.5744, regionalTip: 'Historic stone crossroads. Shielded slightly from light winds, but climbs up here from the coast are steep and sweaty!' },
  { id: 'donji-humac', name: 'Donji Humac', lat: 43.3481, lng: 16.5642, regionalTip: 'Famous stone-mason village. Rolling interior hills mean constant elevation changes and varying crosswinds.' },

  // --- North Coast (Beautiful coastal tracks, but Bura warning zones) ---
  { id: 'supetar', name: 'Supetar', lat: 43.3844, lng: 16.5542, regionalTip: 'Main coastal starting point. Great flat coastal routes toward Mirca, but highly vulnerable to North winds.' },
  { id: 'sutivan', name: 'Sutivan', lat: 43.3839, lng: 16.4758, regionalTip: 'Official bike-friendly town! Fantastic singletracks along the northwest coast. Sheltered from soft southern winds.' },
  { id: 'mirca', name: 'Mirca', lat: 43.3833, lng: 16.5181, regionalTip: 'Quiet olive grove pathways. Flat coastal path to Supetar is easy, but watch out for crashing waves during high Bura winds.' },
  { id: 'splitska', name: 'Splitska', lat: 43.3764, lng: 16.6083, regionalTip: 'Beautiful ancient Roman quarry paths. Deep cove offers coastal shelter, but trails heading inland ramp up quickly.' },
  { id: 'postira', name: 'Postira', lat: 43.3769, lng: 16.6281, regionalTip: 'Gateway to the sandy Lovrečina bay tracks. Coastal routes are rocky and completely exposed to open sea weather.' },
  { id: 'pucisca', name: 'Pučišća', lat: 43.3475, lng: 16.7336, regionalTip: 'Deep, dramatic stone bay. The deep canyon cuts down the wind inside the town, but the climbs out on bikes are massive!' },

  // --- South & West Coast (Protected from Bura, exposed to Jugo / Maestral) ---
  { id: 'bol', name: 'Bol', lat: 43.2622, lng: 16.6542, regionalTip: 'Perfect choice when North wind hits, as the massive mountain ridge blocks it completely. Exposed to rolling Jugo waves.' },
  { id: 'milna', name: 'Milna', lat: 43.3275, lng: 16.4481, regionalTip: 'Highly sheltered maritime bays. Great riding terrain when the open sea is rough or windy.' },
  { id: 'bobovisca', name: 'Bobovišća na Moru', lat: 43.3436, lng: 16.4678, regionalTip: 'Stunning fjord-like descent. The ride down into the bay is beautiful, but remember: what goes down must bike back up!' },
  { id: 'lozisca', name: 'Ložišća', lat: 43.3497, lng: 16.4828, regionalTip: 'Dramatic steep stone village. Trails here feature extreme inclines. Great afternoon sun, but zero wind protection.' },

  // --- Hidden Valleys ---
  { id: 'dol', name: 'Dol', lat: 43.3525, lng: 16.6067, regionalTip: 'Deep, green interior valley. Significantly calmer and less windy than the coast, but traps summer heat like an oven!' },
]

const windProfiles = {
  North: { label: 'Bura', icon: '🌬️', speed: '25 km/h', speedValue: 25, tempShift: -3, humidity: 72 },
  South: { label: 'Jugo', icon: '🌊', speed: '22 km/h', speedValue: 22, tempShift: 1, humidity: 81 },
  West: { label: 'Maestral', icon: '🍃', speed: '18 km/h', speedValue: 18, tempShift: 0, humidity: 68 },
}

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

export function generateCyclingSafetyReport(location, weatherProfile, userProfile = { isSensitiveGroup: false }) {
  const safetyAlerts = []
  let recommendationText = ''
  let isSafeToRide = true

  const { temp, windSpeed, windDirection, rainProbability } = weatherProfile

  if (temp >= 34) {
    isSafeToRide = false
    safetyAlerts.push({
      type: 'EXTREME_HEAT',
      severity: 'CRITICAL',
      message: `🥵 EXTREME HEAT DANGER (${temp}°C): Cycling is strongly discouraged between 11:00 and 17:00. Heatstroke risks are critical.`,
    })
  } else if (temp >= 30) {
    safetyAlerts.push({
      type: 'HIGH_HEAT',
      severity: 'WARNING',
      message: `☀️ High Summer Heat (${temp}°C): Stick to morning rides. Double your water consumption and pack electrolyte tablets.`,
    })
  }

  const isToughUphill = ['vidova-gora', 'praznice', 'gornji-humac', 'lozisca', 'nerezisca'].includes(location.id)
  if (isToughUphill && (temp >= 28 || userProfile.isSensitiveGroup)) {
    safetyAlerts.push({
      type: 'MEDICAL_VULNERABILITY',
      severity: userProfile.isSensitiveGroup ? 'CRITICAL' : 'WARNING',
      message: `❤️ MEDICAL WARNING: The massive, unrelenting uphill climbs in ${location.name} combined with island heat put extreme strain on the cardiovascular system. NOT recommended for seniors, heart patients, or anyone with respiratory conditions.`,
    })
  }

  if (windSpeed >= 45) {
    isSafeToRide = false
    safetyAlerts.push({
      type: 'GALE_FORCE_WIND',
      severity: 'CRITICAL',
      message: `💨 GALE FORCE WIND (${windSpeed} km/h): Do not cycle! Gusts can easily knock a cyclist off the asphalt or push you over macadam ridges.`,
    })
  } else if (windSpeed >= 25) {
    safetyAlerts.push({
      type: 'STRONG_WIND',
      severity: 'WARNING',
      message: `🌬️ Strong Wind (${windSpeed} km/h): High resistance on open plateaus.`,
    })
  }

  if (rainProbability >= 70) {
    safetyAlerts.push({
      type: 'HEAVY_RAIN',
      severity: 'WARNING',
      message: '🌧️ Wet Weather Alert: Heavy rain makes steep descents incredibly slick—especially the smooth coastal stones and loose gravel macadam.',
    })
  }

  if (isSafeToRide) {
    if (windDirection === 'North' && windSpeed >= 15) {
      if (['supetar', 'mirca', 'postira', 'sutivan'].includes(location.id)) {
        recommendationText = '⚠️ Heavy Bura headwind on the North coast. Consider packing up your gear and riding the sheltered South side near Bol today.'
      } else if (location.id === 'bol') {
        recommendationText = '✅ The Vidova Gora mountain massif is successfully blocking the Bura wind. The South coast tracks are highly rideable!'
      }
    } else if (windDirection === 'South' && windSpeed >= 15) {
      if (location.id === 'bol') {
        recommendationText = '⚠️ Strong Jugo wind hitting the South coast directly. Expect rough seaside air and heavy humidity.'
      } else if (['supetar', 'sutivan', 'splitska'].includes(location.id)) {
        recommendationText = '✅ The interior peaks are taking the brunt of the storm. Ideal day to cycle the sheltered North-side loops.'
      }
    } else {
      recommendationText = `Enjoy your ride! ${location.regionalTip}`
    }
  } else {
    recommendationText = '❌ RIDE CANCELLED: Safety conditions are currently too dangerous on this part of the island. Stay off the trails!'
  }

  return { safetyAlerts, recommendationText, isSafeToRide }
}

function getCyclingAdvice(location, windDirection) {
  if (windDirection === 'North') {
    if (location.id === 'supetar') {
      return '⚠️ Dangerous headwind! Postpone climbs out of Supetar. Head west toward Sutivan or load your bike and ride on the South coast instead.'
    }

    if (location.id === 'bol') {
      return '✅ Perfect choice! The mountain massif blocks the Bura wind. Riding along the south coast toward Murvica is highly recommended today.'
    }

    return '⚠️ The North wind is pushing hard across the island. Choose a sheltered inland or southern route for the safest ride.'
  }

  if (windDirection === 'South') {
    if (location.id === 'bol') {
      return '⚠️ Massive waves and strong headwinds coming off the sea. Avoid coastal tracks near Zlatni Rat.'
    }

    if (location.id === 'supetar') {
      return '✅ Great protection. The interior hills take the brunt of the storm. Ideal day for exploring the North-side olive grove paths.'
    }

    return '⚠️ The South wind is turning the coast rough. Keep to protected inland paths and stay flexible with your route.'
  }

  return '🌤️ The breeze is moderate and manageable, so the island roads remain comfortable for a relaxed ride.'
}

function getWeatherSnapshot(location, windDirection) {
  const profile = windProfiles[windDirection]
  const baseTemp = location.id === 'vidova-gora' ? 20 : location.id === 'supetar' ? 24 : location.id === 'bol' ? 27 : location.id === 'milna' ? 25 : 23
  const temp = baseTemp + profile.tempShift

  return {
    temp,
    temperature: `${temp}°C`,
    humidity: profile.humidity,
    windDirection,
    windLabel: profile.label,
    windSpeed: profile.speedValue,
    windSpeedLabel: profile.speed,
    windIcon: profile.icon,
    rainProbability: windDirection === 'South' ? 34 : windDirection === 'West' ? 18 : 12,
    summary: location.id === 'vidova-gora' ? 'High ridge conditions' : 'Island breeze and bright skies',
  }
}

export default function TipsPage() {
  const [currentView, setCurrentView] = useState('menu')
  const [selectedLocation, setSelectedLocation] = useState(BRAC_LOCATIONS[0])
  const [searchTerm, setSearchTerm] = useState(BRAC_LOCATIONS[0].name)
  const [windDirection, setWindDirection] = useState('North')

  const filteredLocations = useMemo(() => {
    const lowerQuery = searchTerm.toLowerCase()
    if (!lowerQuery) return BRAC_LOCATIONS

    return BRAC_LOCATIONS.filter((location) => location.name.toLowerCase().includes(lowerQuery))
  }, [searchTerm])

  const weather = useMemo(() => getWeatherSnapshot(selectedLocation, windDirection), [selectedLocation, windDirection])
  const safetyReport = useMemo(
    () =>
      generateCyclingSafetyReport(
        selectedLocation,
        {
          temp: weather.temp,
          windSpeed: weather.windSpeed,
          windDirection: weather.windDirection,
          rainProbability: weather.rainProbability,
        },
        { isSensitiveGroup: false }
      ),
    [selectedLocation, weather]
  )
  const recommendation = safetyReport.recommendationText

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
              <p>Pick a Brač base and compare the island breeze before you ride.</p>
            </div>

            <div className="weather-selector-panel">
              <label className="weather-label" htmlFor="location-search">Choose a location</label>
              <div className="weather-input-shell">
                <input
                  id="location-search"
                  className="weather-input"
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search Brač locations"
                />

                {filteredLocations.length > 0 && (
                  <div className="weather-option-list">
                    {filteredLocations.map((location) => (
                      <button
                        key={location.id}
                        type="button"
                        className="weather-option"
                        onClick={() => {
                          setSelectedLocation(location)
                          setSearchTerm(location.name)
                        }}
                      >
                        {location.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="weather-card">
              <span className="weather-badge">Live forecast</span>
              <div className="weather-main">
                <div>
                  <div className="weather-location">{selectedLocation.name}</div>
                  <div className="weather-meta">{weather.summary}</div>
                </div>
                <div className="weather-temp">{weather.temperature}</div>
              </div>

              <div className="weather-stat-grid">
                <div className="weather-stat">
                  <span>Humidity</span>
                  <strong>{weather.humidity}%</strong>
                </div>
                <div className="weather-stat">
                  <span>Wind</span>
                  <strong>{weather.windIcon} {weather.windDirection} ({weather.windLabel})</strong>
                </div>
              </div>

              <div className="weather-meta">Wind speed: {weather.windSpeedLabel}</div>

              <div className="wind-toggle-group">
                {(['North', 'South', 'West']).map((direction) => (
                  <button
                    key={direction}
                    type="button"
                    className={`wind-pill${windDirection === direction ? ' active' : ''}`}
                    onClick={() => setWindDirection(direction)}
                  >
                    {windProfiles[direction].icon} {direction}
                  </button>
                ))}
              </div>
            </div>

            <div className="recommendation-box">
              <div className="recommendation-title">Route recommendation</div>
              <p>{recommendation}</p>

              {safetyReport.safetyAlerts.length > 0 && (
                <div className="alert-list">
                  {safetyReport.safetyAlerts.map((alert) => (
                    <div key={alert.type} className={`alert-item ${alert.severity.toLowerCase()}`}>
                      <strong>{alert.severity}</strong>
                      <span>{alert.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
