import { useEffect, useMemo, useState } from 'react'
import { explorerPois } from '../data/poiData'
import finalPlaces from '../final_places.json'
import gastroData from "../data/gastroData.json"
import './TipsPage.css'

const menuItems = [
  'Plan by Weather Forecast',
  'Places to Visit',
  'Gastro Corner',
  'Connect with Local Family Farms',
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

const farmsData = [
  {
        id: 'opg-romano-kusanovic',
    name: 'OPG Romano Kusanović',
    category: 'olive_oil',
    place: 'Sutivan',
    description: 'A multi-generational family estate producing award-winning, extra-virgin olive oil from the native Oblica olive variety.',
    offer: 'organic certified extra-virgin olive oil.',
    phone: '+385 91 570 9912',
    email: 'romano.kusanovic@gmail.com',
    imagePlaceholderColor: '#2f855a', // Deep olive green
},
  {
    id: 'opg-gospodnetic-cheese',
    name: 'Gospodnetić Cheese Farm',
    category: 'cheese',
    place: 'Dol',
    description: 'Famous for traditional Brač sheep cheese ("Brački sir"), aged in stone cellars using ancient island methods.',
    offer: 'Aged sheep cheese, fresh curd (skuta), and homemade fig jams.',
    phone: '+385 98 443 119',
    email: 'gospodnetic.dol@gmail.com',
    imagePlaceholderColor: '#ecc94b', // Cheese yellow
  },
  {
    id: 'opg-kastelan-lamb',
    name: 'Eko-Gospodarstvo Kaštelan',
    category: 'meat',
    place: 'Pražnice',
    description: 'Located on the high inland plains, raising free-roaming island sheep and producing traditional cured meats.',
    offer: 'Brač lamb specialties, cured prosciutto (pršut), and dry-aged pancetta.',
    phone: '+385 91 332 9901',
    email: 'opg.kastelan@outlook.com',
    imagePlaceholderColor: '#9b2c2c', // Meat red
  },
  {
    id: 'opg-postira-gardens',
    name: 'OPG Postira Organic Gardens',
    category: 'vegetables',
    place: 'Postira',
    description: 'Lush organic garden plots utilizing natural spring water to grow pristine Mediterranean vegetables.',
    offer: 'Seasonal vegetable baskets, wild asparagus, sun-dried tomatoes, and capers.',
    phone: '+385 95 887 4423',
    email: 'postira.gardens@gmail.com',
    imagePlaceholderColor: '#38a169', // Veggie green
  },
  {
    id: 'senjkovic-cellars',
    name: 'Senjković Winery & Cellars',
    category: 'drinks',
    place: 'Dračevica',
    description: 'Boutique family winery breathing new life into local grape varieties like Plavac Mali and Pošip.',
    offer: 'Premium wine tastings paired with local delicacies, vineyard walks, and local liqueurs.',
    phone: '+385 91 772 8812',
    email: 'senjkovic.vino@gmail.com',
    imagePlaceholderColor: '#805ad5', // Wine purple
  },
  {
    id: 'jaksic-stone-gallery',
    name: 'Jakšić Stone-Masonry Atelier',
    category: 'crafts',
    place: 'Donji Humac',
    description: 'A family of celebrated academic artists transforming pure white Brač stone into delicate, beautiful utility art.',
    offer: 'Hand-carved stone bowls, decorative mortar & pestles, and custom souvenirs.',
    phone: '+385 21 630 112',
    email: 'jaksic.stone@gmail.com',
    imagePlaceholderColor: '#718096', // Slate stone gray
  }
]

function buildImageCandidates(id, imageFileName) {
  const candidates = []
  const pushCandidate = (value) => {
    if (value && !candidates.includes(value)) {
      candidates.push(value)
    }
  }

  if (imageFileName) {
    pushCandidate(`/images/${imageFileName}`)
  }

  if (id) {
    const extensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'jfif', 'JPG', 'JPEG', 'PNG', 'WEBP', 'GIF', 'JFIF']
    extensions.forEach((extension) => {
      pushCandidate(`/images/${id}.${extension}`)
    })
  }

  return candidates
}

function ExplorerCardMedia({ name, imageCandidates, backgroundColor }) {
  const [candidateIndex, setCandidateIndex] = useState(0)
  const activeSrc = imageCandidates[candidateIndex]

  return (
    <div
      className="explorer-card-media"
      aria-hidden="true"
      style={{ backgroundColor }}
    >
      {activeSrc ? (
        <img
          className="explorer-card-image"
          src={activeSrc}
          alt=""
          onError={() => setCandidateIndex((currentIndex) => currentIndex + 1)}
        />
      ) : (
        <span>{name.charAt(0)}</span>
      )}
    </div>
  )
}

function normalizeLookup(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function formatCategoryLabel(category = '') {
  const cleaned = category.trim()
  if (!cleaned) {
    return 'Other'
  }

  return cleaned.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}

function PlacesToVisitView({
  onBack,
  townships,
  selectedTownship,
  onSelectTownship,
  onClearTownship,
  townStory,
  items,
  searchValue,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  expandedId,
  onToggleExpanded,
  categoryOptions,
}) {
  return (
    <div className="tips-subview">
      <div className="places-toolbar">
        <button type="button" className="tips-back-button" onClick={onBack}>
          ← Back to Tips
        </button>

        {selectedTownship && (
          <button type="button" className="tips-back-button tips-back-button-secondary" onClick={onClearTownship}>
            ← All Towns
          </button>
        )}
      </div>

      <div className="tips-subview-header">
        <h2>{selectedTownship || 'Places to Visit'}</h2>
        <p>
          {selectedTownship
            ? townStory || 'Choose a category below to narrow down the highlights in this town.'
            : 'Choose a town first, then browse all of its points of interest and filter them by the real JSON categories.'}
        </p>
      </div>

      {selectedTownship ? (
        <>
          <div className="explorer-controls">
            <label className="explorer-search">
              <span className="sr-only">Search places in {selectedTownship}</span>
              <input
                type="search"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={`Search inside ${selectedTownship}`}
              />
            </label>

            <div className="explorer-pill-row" role="tablist" aria-label="Filter by place category">
              {categoryOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`explorer-pill${activeCategory === option.key ? ' active' : ''}`}
                  onClick={() => onCategoryChange(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card-list explorer-list">
            {items.length === 0 ? (
              <div className="explorer-empty-state">No places match this category or search yet.</div>
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
                      <ExplorerCardMedia
                        name={item.name}
                        imageCandidates={item.imageCandidates || []}
                        backgroundColor={item.imagePlaceholderColor}
                      />

                      <div className="explorer-card-body">
                        <div className="explorer-card-title-row">
                          <h3>{item.name}</h3>
                          <span className="explorer-card-badge">{item.category}</span>
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
        </>
      ) : (
        <div className="township-selector-list">
          {townships.map((township) => (
            <button
              key={township.name}
              type="button"
              className="township-selector-card"
              onClick={() => onSelectTownship(township.name)}
            >
              <div className="township-selector-meta">
                <strong>{township.name}</strong>
                <span>{township.count} places</span>
              </div>
              <p>{township.story}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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
                    <ExplorerCardMedia
                      name={item.name}
                      imageCandidates={item.imageCandidates || []}
                      backgroundColor={item.imagePlaceholderColor}
                    />

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

function hashToColor(value) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = value.charCodeAt(index) + ((hash << 5) - hash)
  }

  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 65% 52%)`
}

const placesToVisitPois = (finalPlaces.features || []).map((feature) => {
  const properties = feature.properties || {}
  const name = properties['name-en'] || properties.name || properties.title || 'Unnamed place'
  const rawTownship = properties.Township || properties.location || 'Brač'
  const townshipAliases = {
    spltska: 'Splitska',
  }
  const townStories = finalPlaces.townStories || {}
  const townStoryLookup = Object.fromEntries(
    Object.keys(townStories).map((townshipName) => [normalizeLookup(townshipName), townshipName])
  )
  const normalizedTownship = normalizeLookup(rawTownship)
  const canonicalTownship = townStoryLookup[townshipAliases[normalizedTownship] || normalizedTownship] || rawTownship
  const story = properties.story || properties.description || 'No story available yet.'
  const shortDesc = story.length > 140 ? `${story.slice(0, 137)}...` : story
  const category = formatCategoryLabel(properties.Category || properties.category || '')

  return {
    id: properties.id || properties.fid || name,
    name,
    township: canonicalTownship,
    shortDesc,
    story,
    category,
    imageCandidates: buildImageCandidates(properties.id, properties.image),
    imagePlaceholderColor: hashToColor(name),
  }
})

export default function TipsPage() {
  const [currentView, setCurrentView] = useState('menu')
  const [selectedLocation, setSelectedLocation] = useState(BRAC_LOCATIONS[0])
  const [weatherData, setWeatherData] = useState(null)
  const [selectedTimeframe, setSelectedTimeframe] = useState('CURRENT')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isSensitiveGroup, setIsSensitiveGroup] = useState(false)
  
  // States for general search/category filtering
  const [poiSearch, setPoiSearch] = useState('')
  const [poiCategory, setPoiCategory] = useState('all')
  const [selectedTownship, setSelectedTownship] = useState(null)
  const [expandedPoiId, setExpandedPoiId] = useState(null)

  // Explicit states for Local Family Farms View
  const [farmSearch, setFarmSearch] = useState('')
  const [farmCategory, setFarmCategory] = useState('all')

  // Reset helper when changing main views
  useEffect(() => {
    setPoiSearch('')
    setPoiCategory('all')
    setSelectedTownship(null)
    setExpandedPoiId(null)
    setFarmSearch('')
    setFarmCategory('all')
  }, [currentView])

  useEffect(() => {
    setPoiSearch('')
    setPoiCategory('all')
    setExpandedPoiId(null)
  }, [selectedTownship])

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

  const placesTownships = useMemo(() => {
    const townStories = finalPlaces.townStories || {}
    const grouped = new Map()

    placesToVisitPois.forEach((poi) => {
      if (!grouped.has(poi.township)) {
        grouped.set(poi.township, [])
      }
      grouped.get(poi.township).push(poi)
    })

    return Array.from(grouped.entries())
      .map(([township, pois]) => ({
        name: township,
        count: pois.length,
        story: townStories[township] || `Explore ${township} through its local heritage and points of interest.`,
      }))
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [])

  const selectedTownshipItems = useMemo(() => {
    if (!selectedTownship) {
      return []
    }

    const normalizedSearch = poiSearch.trim().toLowerCase()

    return placesToVisitPois.filter((poi) => {
      if (poi.township !== selectedTownship) {
        return false
      }

      if (poiCategory !== 'all' && poi.category !== poiCategory) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const searchableText = `${poi.name} ${poi.category} ${poi.shortDesc} ${poi.story}`.toLowerCase()
      return searchableText.includes(normalizedSearch)
    })
  }, [poiCategory, poiSearch, selectedTownship])

  const placesCategoryOptions = useMemo(() => {
    if (!selectedTownship) {
      return [{ key: 'all', label: 'All categories' }]
    }

    const categories = Array.from(
      new Set(
        placesToVisitPois
          .filter((poi) => poi.township === selectedTownship)
          .map((poi) => poi.category)
      )
    ).sort((left, right) => left.localeCompare(right))

    return [{ key: 'all', label: 'All categories' }, ...categories.map((category) => ({ key: category, label: category }))]
  }, [selectedTownship])

  // Custom Memoized Farm Filter
  const filteredFarms = useMemo(() => {
    const normalizedSearch = farmSearch.trim().toLowerCase()

    return farmsData.filter((farm) => {
      if (farmCategory !== 'all' && farm.category !== farmCategory) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const searchableText = `${farm.name} ${farm.place} ${farm.description} ${farm.offer}`.toLowerCase()
      return searchableText.includes(normalizedSearch)
    })
  }, [farmCategory, farmSearch])

  const farmCategoryOptions = [
    { key: 'all', label: 'All', icon: '🧑‍🌾' },
    { key: 'olive_oil', label: 'Olive Oil', icon: '🫒' },
    { key: 'cheese', label: 'Cheese', icon: '🧀' },
    { key: 'meat', label: 'Meat', icon: '🥩' },
    { key: 'vegetables', label: 'Vegetables', icon: '🥦' },
    { key: 'drinks', label: 'Drinks', icon: '🍷' },
    { key: 'crafts', label: 'Traditional Crafts', icon: '🪨' },
  ]

  const explorerCategoryOptions = [
    { key: 'all', label: 'All', icon: '🧭' },
    { key: 'viewpoint', label: 'Viewpoints', icon: '🏔' },
    { key: 'beach_cove', label: 'Beaches', icon: '🏖' },
    { key: 'monastery', label: 'Monasteries', icon: '⛪' },
    { key: 'gastro', label: 'Gastro', icon: '🍷' },
    { key: 'stone_heritage', label: 'Stone Heritage', icon: '🪨' },
    { key: 'village', label: 'Villages', icon: '🏘' },
  ]

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
                  <span className="weather-badge">{activeWeather?.label}</span>
                  <div className="weather-display-row">
                    <div className="weather-temp-hero">
                      <h3>{activeWeather?.temp}°C</h3>
                      <p>{activeWeather?.displayTime}</p>
                    </div>
                    <div className="weather-stats-grid">
                      <div>💨 Wind Speed: <strong>{activeWeather?.windSpeed} km/h</strong></div>
                      <div>🧭 Direction: <strong>{activeWeather?.windDirection}</strong></div>
                      <div>🌧️ Rain Prob: <strong>{activeWeather?.rainProbability}%</strong></div>
                    </div>
                  </div>
                </div>

                <div className="weather-advisory-box">
                  <h4>🗺️ Routing Recommendation:</h4>
                  <p>{recommendation}</p>
                </div>

                {safetyReport?.safetyAlerts && safetyReport.safetyAlerts.length > 0 && (
                  <div className="weather-alerts">
                    {safetyReport.safetyAlerts.map((alert, index) => (
                      <div
                        key={`${alert.type}-${index}`}
                        className={`safety-alert-row ${alert.severity.toLowerCase()}`}
                      >
                        {alert.message}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : currentView === 'Places to Visit' ? (
          <PlacesToVisitView
            onBack={() => setCurrentView('menu')}
            townships={placesTownships}
            selectedTownship={selectedTownship}
            onSelectTownship={setSelectedTownship}
            onClearTownship={() => setSelectedTownship(null)}
            townStory={finalPlaces.townStories?.[selectedTownship]}
            items={selectedTownshipItems}
            searchValue={poiSearch}
            onSearchChange={setPoiSearch}
            activeCategory={poiCategory}
            onCategoryChange={setPoiCategory}
            expandedId={expandedPoiId}
            onToggleExpanded={(id) => setExpandedPoiId(expandedPoiId === id ? null : id)}
            categoryOptions={placesCategoryOptions}
          />
        ) : currentView === 'Gastro Corner' ? (
          <div className="tips-subview">
            <button type="button" className="tips-back-button" onClick={() => setCurrentView('menu')}>
              ← Back to Tips
            </button>

            <div className="tips-subview-header">
              <h2>🍷 Gastro Corner</h2>
              <p>Recharge after your ride with legendary local dishes and partner taverns.</p>
            </div>

            {/* 1. Traditional Foods Section */}
            <h3 style={{ fontSize: '1.2rem', color: '#b794f4', marginBottom: '15px', marginTop: '20px', fontWeight: 'bold' }}>🍽️ Must-Try Traditional Dishes</h3>
            <div className="card-list">
              {gastroData.traditionalFoods.map((food) => (
                <article key={food.id} className="tips-card">
                  <div className="tips-card-media" aria-hidden="true" style={{ fontSize: '1.5rem' }}>
                    🍲
                  </div>
                  <div className="tips-card-body">
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#d6bcfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Traditional Specialty • Brač Island
                    </span>
                    <h3 style={{ margin: '4px 0 6px 0', color: '#ffffff' }}>{food.name}</h3>
                    <p style={{ color: '#f7fafc' }}>{food.description}</p>
                  </div>
                </article>
              ))}
            </div>

            {/* 2. Partner Restaurants Section */}
            <h3 style={{ fontSize: '1.2rem', color: '#b794f4', marginBottom: '15px', marginTop: '30px', fontWeight: 'bold' }}>📍 Recommended Bicycle-Friendly Stops</h3>
            <div className="card-list">
              {gastroData.restaurants.map((rest) => (
                <article key={rest.id} className="tips-card" style={{ display: 'block', padding: '16px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#d6bcfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Konoba / Restoran • {rest.place}
                  </span>
                  <h3 style={{ margin: '4px 0 8px 0', fontSize: '1.2rem', color: '#ffffff' }}>{rest.name}</h3>
                  <p style={{ marginBottom: '12px', color: '#f7fafc' }}>{rest.description}</p>
                  
                  {/* Contact Block */}
                  <div style={{ fontSize: '0.8rem', color: '#edf2f7', borderTop: '1px dashed rgba(255, 255, 255, 0.2)', paddingTop: '8px', marginTop: '10px' }}>
                    <div style={{ marginBottom: '4px' }}><span style={{ color: '#d6bcfa' }}>🕒 Hours:</span> {rest.workingHours}</div>
                    <div style={{ marginBottom: '4px' }}><span style={{ color: '#d6bcfa' }}>📞 Phone:</span> {rest.phone}</div>
                    <div><span style={{ color: '#d6bcfa' }}>✉️ Email:</span> {rest.email}</div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : currentView === 'Connect with Local Family Farms' ? (
          <div className="tips-subview">
            <button type="button" className="tips-back-button" onClick={() => setCurrentView('menu')}>
              ← Back to Tips
            </button>

            <div className="tips-subview-header">
              <h2>🌿 Connect with Local Family Farms</h2>
              <p>Cycle right to the source. Meet the island families keeping ancient agricultural traditions alive.</p>
            </div>

            {/* Filters and Search Bar */}
            <div className="explorer-controls">
              <label className="explorer-search">
                <span className="sr-only">Search farms</span>
                <input
                  type="search"
                  value={farmSearch}
                  onChange={(event) => setFarmSearch(event.target.value)}
                  placeholder="Search farms by name, village, or product..."
                />
              </label>

              <div className="explorer-pill-row" role="tablist" aria-label="Filter farms by category">
                {farmCategoryOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`explorer-pill${farmCategory === option.key ? ' active' : ''}`}
                    onClick={() => setFarmCategory(option.key)}
                  >
                    {option.icon} {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Farms Grid */}
            <div className="card-list">
              {filteredFarms.length === 0 ? (
                <div className="explorer-empty-state">No family farms match your search criteria.</div>
              ) : (
                filteredFarms.map((farm) => (
                  <article key={farm.id} className="tips-card" style={{ display: 'flex', flexDirection: 'column', padding: '16px', gap: '12px' }}>
                    
                    {/* Header Block: Media + Title metadata */}
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <ExplorerCardMedia
                        name={farm.name}
                        imageCandidates={buildImageCandidates(farm.id)}
                        backgroundColor={farm.imagePlaceholderColor}
                      />
                      <div>
                        {/* Subtitle Category tag */}
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#d6bcfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {farm.category.replace('_', ' ')} • {farm.place}
                        </span>
                        {/* Card Title Header */}
                        <h3 style={{ margin: '2px 0 0 0', fontSize: '1.25rem', fontWeight: '700', color: '#ffffff' }}>{farm.name}</h3>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div style={{ flex: '1' }}>
                      {/* Main description paragraph */}
                      <p style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#f7fafc', lineHeight: '1.4' }}>
                        {farm.description}
                      </p>
                      
                      {/* What they offer */}
                      <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', borderLeft: '3px solid #b794f4', padding: '8px 12px', borderRadius: '4px', margin: '10px 0' }}>
                        <strong style={{ fontSize: '0.8rem', color: '#e2e8f0', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                          🎁 What They Offer:
                        </strong>
                        <span style={{ fontSize: '0.9rem', color: '#ffffff' }}>{farm.offer}</span>
                      </div>
                    </div>

                    {/* Contact footer */}
                    <div style={{ fontSize: '0.8rem', color: '#f7fafc', borderTop: '1px dashed rgba(255, 255, 255, 0.2)', paddingTop: '10px', marginTop: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                        <div>📞 <b style={{ color: '#d6bcfa' }}>Phone:</b> <a href={`tel:${farm.phone}`} style={{ color: '#ffffff', textDecoration: 'underline' }}>{farm.phone}</a></div>
                        <div>✉️ <b style={{ color: '#d6bcfa' }}>Email:</b> <a href={`mailto:${farm.email}`} style={{ color: '#ffffff', textDecoration: 'underline' }}>{farm.email}</a></div>
                      </div>
                    </div>

                  </article>
                ))
              )}
            </div>
          </div>
        ) : (
          <SectionView
            title={sectionContent[currentView].title}
            description={sectionContent[currentView].description}
            items={sectionContent[currentView].items}
            onBack={() => setCurrentView('menu')}
            variant="default"
            searchValue={poiSearch}
            onSearchChange={setPoiSearch}
            activeCategory={poiCategory}
            onCategoryChange={setPoiCategory}
            expandedId={expandedPoiId}
            onToggleExpanded={(id) => setExpandedPoiId(expandedPoiId === id ? null : id)}
            categoryOptions={explorerCategoryOptions}
          />
        )}
      </div>
    </div>
  )
}