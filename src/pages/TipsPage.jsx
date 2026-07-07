import { useEffect, useMemo, useState } from 'react'
import { explorerPois } from '../data/poiData'
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

function SectionView({
  title,
  description,
  items,
  onBack,
  variant = 'default',
  searchValue = '',
  onSearchChange = () => {},
  activeCategory = 'all',
  onCategoryChange = () => {},
  expandedId = null,
  onToggleExpanded = () => {},
  categoryOptions = [],
}) {
  const isExplorerView = variant === 'explorer'

  return (
    <div className="tips-subview">
      <button type="button" className="tips-back-button" onClick={onBack}>
        ← Back to Tips
      </button>

      {isExplorerView && (
        <div className="explorer-controls">
          <label className="explorer-search">
            <span className="sr-only">Search island highlights</span>
            <input
              type="search"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by name, township, or theme"
            />
          </label>

          <div className="explorer-pill-row" role="tablist" aria-label="Explore by category">
            {categoryOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`explorer-pill${activeCategory === option.key ? ' active' : ''}`}
                onClick={() => onCategoryChange(option.key)}
              >
                {option.icon} {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="tips-subview-header">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      {isExplorerView ? (
        <div className="card-list explorer-list">
          {items.length === 0 ? (
            <div className="explorer-empty-state">No stories match your current search yet.</div>
          ) : (
            items.map((item) => {
              const isExpanded = expandedId === item.id

              return (
                <article key={item.id} className={`explorer-card${isExpanded ? ' expanded' : ''}`}>
                  <button
                    type="button"
                    className="explorer-card-summary"
                    onClick={() => onToggleExpanded(item.id)}
                    aria-expanded={isExpanded}
                  >
                    <div
                      className="explorer-card-media"
                      aria-hidden="true"
                      style={{ backgroundColor: item.imagePlaceholderColor }}
                    >
                      <span>{item.name.charAt(0)}</span>
                    </div>

                    <div className="explorer-card-body">
                      <div className="explorer-card-title-row">
                        <h3>{item.name}</h3>
                        <span className="explorer-card-badge">{item.township}</span>
                      </div>
                      <p>{item.shortDesc}</p>
                    </div>
                  </button>

                  <div className={`explorer-card-story${isExpanded ? ' open' : ''}`}>
                    <p>{item.story}</p>
                  </div>
                </article>
              )
            })
          )}
        </div>
      ) : (
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
      )}
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

function getWeatherDirectionLabel(degrees) {
  if (degrees >= 315 || degrees < 45) return 'North'
  if (degrees >= 45 && degrees < 135) return 'East'
  if (degrees >= 135 && degrees < 225) return 'South'
  if (degrees >= 225 && degrees < 315) return 'West'
  return 'Variable'
}

function formatForecastDay(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default function TipsPage() {
  const [currentView, setCurrentView] = useState('menu')
  const [selectedLocation, setSelectedLocation] = useState(BRAC_LOCATIONS[0])
  const [weatherData, setWeatherData] = useState(null)
  const [selectedTimeframe, setSelectedTimeframe] = useState('CURRENT')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isSensitiveGroup, setIsSensitiveGroup] = useState(false)
  const [poiSearch, setPoiSearch] = useState('')
  const [poiCategory, setPoiCategory] = useState('all')
  const [expandedPoiId, setExpandedPoiId] = useState(null)

  useEffect(() => {
    setPoiSearch('')
    setPoiCategory('all')
    setExpandedPoiId(null)
  }, [currentView])

  useEffect(() => {
    const fetchComprehensiveWeatherData = async () => {
      setLoading(true)
      setError(null)

      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${selectedLocation.lat}&longitude=${selectedLocation.lng}&current=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation_probability&timezone=auto&forecast_days=3`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error('Could not reach Adriatic weather nodes.')
        }

        const data = await response.json()

        const currentProfile = {
          label: '⚡ LIVE NOW',
          temp: data.current.temperature_2m,
          windSpeed: data.current.wind_speed_10m,
          windDirection: getWeatherDirectionLabel(data.current.wind_direction_10m),
          rainProbability: data.current.precipitation > 0 ? 90 : 0,
          displayTime: 'Current Conditions',
        }

        const hourlyProfiles = data.hourly.time.map((timeStr, index) => {
          const dateObj = new Date(timeStr)
          const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
          const hourLabel = `${dateObj.toLocaleTimeString('en-US', { hour: '2-digit', hour12: false })}:00`

          return {
            label: `${dayLabel} ${hourLabel}`,
            temp: data.hourly.temperature_2m[index],
            windSpeed: data.hourly.wind_speed_10m[index],
            windDirection: getWeatherDirectionLabel(data.hourly.wind_direction_10m[index]),
            rainProbability: data.hourly.precipitation_probability[index],
            displayTime: `${dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at ${hourLabel}`,
          }
        })

        setWeatherData({ current: currentProfile, hourly: hourlyProfiles })
        setSelectedTimeframe('CURRENT')
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchComprehensiveWeatherData()
  }, [selectedLocation])

  const activeWeather = weatherData
    ? (selectedTimeframe === 'CURRENT' ? weatherData.current : weatherData.hourly[selectedTimeframe])
    : null

  const safetyReport = activeWeather
    ? generateCyclingSafetyReport(
        selectedLocation,
        {
          temp: activeWeather.temp,
          windSpeed: activeWeather.windSpeed,
          windDirection: activeWeather.windDirection,
          rainProbability: activeWeather.rainProbability,
        },
        { isSensitiveGroup }
      )
    : null
  const recommendation = safetyReport?.recommendationText ?? 'Loading live safety insights...'

  const explorerCategoryOptions = currentView === 'Gastro Corner'
    ? [
        { key: 'all', label: 'All', icon: '🍽️' },
        { key: 'gastro', label: 'Gastro', icon: '🍷' },
      ]
    : [
        { key: 'all', label: 'All', icon: '🧭' },
        { key: 'viewpoint', label: 'Viewpoints', icon: '🏔' },
        { key: 'beach_cove', label: 'Beaches', icon: '🏖' },
        { key: 'monastery', label: 'Monasteries', icon: '⛪' },
        { key: 'gastro', label: 'Gastro', icon: '🍷' },
        { key: 'stone_heritage', label: 'Stone Heritage', icon: '🪨' },
        { key: 'village', label: 'Villages', icon: '🏘' },
      ]

  const explorerSectionItems = useMemo(() => {
    const baseItems = currentView === 'Gastro Corner'
      ? explorerPois.filter((poi) => poi.category === 'gastro')
      : explorerPois.filter((poi) => poi.category !== 'gastro')

    const normalizedSearch = poiSearch.trim().toLowerCase()

    return baseItems.filter((poi) => {
      if (poiCategory !== 'all' && poi.category !== poiCategory) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const searchableText = `${poi.name} ${poi.township} ${poi.shortDesc} ${poi.story}`.toLowerCase()
      return searchableText.includes(normalizedSearch)
    })
  }, [currentView, poiCategory, poiSearch])

  const sectionContent = {
    'Places to Visit': {
      title: 'Places to Visit',
      description: 'Discover scenic highlights that pair beautifully with a relaxed island ride.',
      items: [],
    },
    'Gastro Corner': {
      title: 'Gastro Corner',
      description: 'Find the best island bites for a memorable rest stop after your route.',
      items: [],
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
              <select
                className="weather-input"
                value={selectedLocation.id}
                onChange={(event) => {
                  const nextLocation = BRAC_LOCATIONS.find((location) => location.id === event.target.value)
                  if (nextLocation) {
                    setSelectedLocation(nextLocation)
                  }
                }}
              >
                {BRAC_LOCATIONS.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="toggle-row">
              <input
                type="checkbox"
                checked={isSensitiveGroup}
                onChange={(event) => setIsSensitiveGroup(event.target.checked)}
              />
              <span>Include Senior / Heart Patient Safety Warnings</span>
            </label>

            {loading && <div className="weather-meta">Syncing local weather profiles...</div>}
            {error && <div className="weather-error">Error: {error}</div>}

            {weatherData && !loading && (
              <>
                <div className="timeline-scroll-axis">
                  <button
                    type="button"
                    className={`timeline-pill${selectedTimeframe === 'CURRENT' ? ' active' : ''}`}
                    onClick={() => setSelectedTimeframe('CURRENT')}
                  >
                    📍 Live Now
                  </button>

                  {weatherData.hourly.map((hourBlock, index) => {
                    if (index % 2 !== 0) {
                      return null
                    }

                    const isSelected = selectedTimeframe === index

                    return (
                      <button
                        key={`${hourBlock.label}-${index}`}
                        type="button"
                        className={`timeline-pill${isSelected ? ' active' : ''}`}
                        onClick={() => setSelectedTimeframe(index)}
                      >
                        <span>{hourBlock.label}</span>
                        <strong>{hourBlock.temp}°C</strong>
                      </button>
                    )
                  })}
                </div>

                <div className="weather-card">
                  <span className="weather-badge">Live forecast</span>
                  <div className="weather-main">
                    <div>
                      <div className="weather-location">{selectedLocation.name}</div>
                      <div className="weather-meta">{activeWeather.displayTime}</div>
                    </div>
                    <div className="weather-temp">{activeWeather.temp}°C</div>
                  </div>

                  <div className="weather-stat-grid">
                    <div className="weather-stat">
                      <span>Wind</span>
                      <strong>{activeWeather.windDirection}</strong>
                    </div>
                    <div className="weather-stat">
                      <span>Speed</span>
                      <strong>{activeWeather.windSpeed} km/h</strong>
                    </div>
                  </div>

                  <div className="weather-meta">Rain risk: {activeWeather.rainProbability}%</div>
                </div>
              </>
            )}

            <div className="recommendation-box">
              <div className="recommendation-title">Route recommendation</div>
              <p>{recommendation}</p>

              {safetyReport?.safetyAlerts.length > 0 && (
                <div className="alert-list">
                  {safetyReport.safetyAlerts.map((alert) => (
                    <div key={alert.type} className={`alert-badge ${alert.severity.toUpperCase()}`}>
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
            items={['Places to Visit', 'Gastro Corner'].includes(currentView) ? explorerSectionItems : sectionContent[currentView].items}
            onBack={() => setCurrentView('menu')}
            variant={['Places to Visit', 'Gastro Corner'].includes(currentView) ? 'explorer' : 'default'}
            searchValue={poiSearch}
            onSearchChange={setPoiSearch}
            activeCategory={poiCategory}
            onCategoryChange={setPoiCategory}
            expandedId={expandedPoiId}
            onToggleExpanded={(itemId) => setExpandedPoiId((currentId) => (currentId === itemId ? null : itemId))}
            categoryOptions={explorerCategoryOptions}
          />
        )}
      </div>
    </div>
  )
}
