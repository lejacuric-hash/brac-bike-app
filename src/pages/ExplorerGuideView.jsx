import { useMemo, useState } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet'
import './TrailsPage.css'
import { BRAC_POIS } from '../data/poiData.js'

const CATEGORY_MAP = {
  viewpoint: { label: 'Viewpoints', color: '#FF5722' },
  beach_cove: { label: 'Beaches', color: '#00BCD4' },
  geological: { label: '🪨 Geology Museum', color: '#795548' },
  archaeology: { label: '🏛 Archaeology', color: '#607D8B' },
  monastery: { label: '⛪ Churches & Chapels', color: '#E91E63' },
  military: { label: '🚢 Military History', color: '#3F51B5' },
  water: { label: '🚰 Water & Wells', color: '#2196F3' },
  gastro: { label: '🍷 Local Gastro Farms', color: '#4CAF50' },
  bike_highlight: { label: '🚴 Bike Highlights', color: '#9C27B0' },
  nature_monument: { label: '🌿 Nature Monuments', color: '#4CAF50' },
}

export default function ExplorerGuideView() {
  const [activeCategories, setActiveCategories] = useState(Object.keys(CATEGORY_MAP))
  const [selectedPoi, setSelectedPoi] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  const handleToggleCategory = (catKey) => {
    setActiveCategories((prev) =>
      prev.includes(catKey) ? prev.filter((key) => key !== catKey) : [...prev, catKey]
    )
  }

  const filteredPois = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase()

    return BRAC_POIS.filter((poi) => {
      const matchesCategory =
        activeCategories.includes(poi.category) ||
        poi.subCategories?.some((sub) => activeCategories.includes(sub))
      const matchesSearch =
        poi.name.toLowerCase().includes(normalizedTerm) ||
        poi.shortDesc.toLowerCase().includes(normalizedTerm) ||
        poi.story.toLowerCase().includes(normalizedTerm)

      return matchesCategory && matchesSearch
    })
  }, [activeCategories, searchTerm])

  return (
    <div className="explorer-guide-shell">
      <div className="explorer-guide-toolbar">
        <input
          type="text"
          className="explorer-search"
          placeholder="🔎 Search viewpoints, water, gastro and more"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />

        <div className="category-scroll">
          {Object.entries(CATEGORY_MAP).map(([key, config]) => {
            const isActive = activeCategories.includes(key)
            return (
              <button
                key={key}
                type="button"
                className={`category-pill${isActive ? ' active' : ''}`}
                style={{ backgroundColor: isActive ? config.color : '#250046' }}
                onClick={() => handleToggleCategory(key)}
              >
                {config.label} {isActive ? '✓' : ''}
              </button>
            )
          })}
        </div>

        <div className="filter-caption">
          Showing {filteredPois.length} active marker points on the Brač explorer guide
        </div>
      </div>

      <div className="explorer-guide-body">
        <div className="explorer-map-panel">
          <MapContainer
            center={[43.307, 16.635]}
            zoom={10}
            scrollWheelZoom
            className="explorer-map"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
            />

            {filteredPois.map((poi) => (
              <CircleMarker
                key={poi.id}
                center={[poi.coordinates.lat, poi.coordinates.lng]}
                radius={8}
                eventHandlers={{ click: () => setSelectedPoi(poi) }}
                pathOptions={{
                  color: '#ffffff',
                  fillColor: CATEGORY_MAP[poi.category]?.color || '#8b5cf6',
                  fillOpacity: 0.95,
                  weight: 2,
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={1} sticky>
                  <div className="poi-tooltip">{poi.name}</div>
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        <div className="explorer-list-panel">
          {filteredPois.map((poi) => (
            <button
              key={poi.id}
              type="button"
              className="explorer-card"
              onClick={() => setSelectedPoi(poi)}
            >
              <span className="explorer-card-tag" style={{ backgroundColor: CATEGORY_MAP[poi.category]?.color || '#8b5cf6' }}>
                {poi.category.replace('_', ' ')}
              </span>
              <h4>{poi.name}</h4>
              <p>{poi.shortDesc}</p>
              <div className="explorer-card-meta">
                <span>⛰️ {poi.elevation}m</span>
                <span>🚲 {poi.accessibility.split('/')[0]}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedPoi && (
        <div className="story-panel open">
          <div className="story-panel-header">
            <div>
              <span className="story-badge" style={{ backgroundColor: CATEGORY_MAP[selectedPoi.category]?.color || '#8b5cf6' }}>
                {selectedPoi.category.toUpperCase()}
              </span>
              <h3>{selectedPoi.name}</h3>
              <p>
                📍 {selectedPoi.township.toUpperCase()} · Amenities: {selectedPoi.amenities.join(', ')}
              </p>
            </div>
            <button type="button" className="story-close" onClick={() => setSelectedPoi(null)}>
              ✕
            </button>
          </div>

          <div className="story-body">
            <div className="story-section">
              <div className="story-label">Short Description</div>
              <div>{selectedPoi.shortDesc}</div>
            </div>

            <div className="story-section">
              <div className="story-label">Accessibility</div>
              <div>{selectedPoi.accessibility}</div>
            </div>

            <div className="story-section">
              <div className="story-label">Island Story</div>
              <div>“{selectedPoi.story}”</div>
            </div>
          </div>

          <button type="button" className="story-action">
            🗺️ Route me here
          </button>
        </div>
      )}
    </div>
  )
}
