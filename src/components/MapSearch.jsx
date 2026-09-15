import { useState, useCallback, useRef } from 'react'
import PropTypes from 'prop-types'

// Mirrors the key fallback chain in TrailsPage.jsx so search keeps working even if
// only one of the two env var names is configured on the host.
const MAPTILER_FALLBACK_KEY = 'TjtNydvQmJJGJOelz7ji'
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_API_KEY || import.meta.env.VITE_MAPTILER_KEY || MAPTILER_FALLBACK_KEY

export default function MapSearch({ onResultSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef(null)

  const search = useCallback(async (text) => {
    if (!text || text.length < 2) {
      setResults([])
      setShowResults(false)
      return
    }

    setLoading(true)
    try {
      // Search within Croatia bounding box, biased toward Brač
      const response = await fetch(
        `https://api.maptiler.com/geocoding/${encodeURIComponent(text)}.json` +
        `?key=${MAPTILER_KEY}` +
        `&bbox=16.0,43.1,17.2,43.6` + // Brač bounding box
        `&language=en,hr` +
        `&limit=5`
      )
      const data = await response.json()
      setResults(data.features || [])
      setShowResults(true)
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInput = (e) => {
    const text = e.target.value
    setQuery(text)

    // Debounce search by 300ms
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(text), 300)
  }

  const handleSelect = (result) => {
    setQuery(result.place_name || result.text)
    setShowResults(false)
    setResults([])

    // Pass coordinates to parent to fly map there
    const [lng, lat] = result.center || result.geometry.coordinates
    onResultSelect({ lat, lng, name: result.place_name || result.text })
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setShowResults(false)
  }

  return (
    <div style={{
      position: 'absolute',
      top: 'calc(64px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))',
      left: '16px',
      right: '78px',
      zIndex: 1550,
    }}>
      {/* Search input */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(31, 9, 49, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(117, 60, 174, 0.4)',
        borderRadius: showResults && results.length > 0 ? '16px 16px 0 0' : '999px',
        padding: '10px 16px',
        gap: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}>
        <span style={{ fontSize: 16 }}>🔍</span>
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => {
            // Scroll search bar into view on mobile so an on-screen keyboard doesn't cover it
            setTimeout(() => {
              document.activeElement?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }, 300)
          }}
          placeholder="Search places on Brač..."
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#ffffff',
            fontSize: 14,
            fontFamily: 'inherit',
          }}
        />
        {loading && (
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>...</span>
        )}
        {query && !loading && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              fontSize: 16,
              padding: 0,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {showResults && results.length > 0 && (
        <div style={{
          background: 'rgba(31, 9, 49, 0.97)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(117, 60, 174, 0.4)',
          borderTop: 'none',
          borderRadius: '0 0 16px 16px',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          maxHeight: '50vh',
          overflowY: 'auto',
        }}>
          {results.map((result, index) => (
            <button
              key={result.id || index}
              type="button"
              onClick={() => handleSelect(result)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                borderTop: index > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                color: '#ffffff',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 13,
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>📍</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {result.text || result.place_name?.split(',')[0]}
                </div>
                <div style={{
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 11,
                  marginTop: 2,
                }}>
                  {result.place_name}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {showResults && results.length === 0 && !loading && query.length > 2 && (
        <div style={{
          background: 'rgba(31, 9, 49, 0.97)',
          border: '1px solid rgba(117, 60, 174, 0.4)',
          borderTop: 'none',
          borderRadius: '0 0 16px 16px',
          padding: '12px 16px',
          color: 'rgba(255,255,255,0.5)',
          fontSize: 13,
        }}>
          No places found for &quot;{query}&quot;
        </div>
      )}
    </div>
  )
}

MapSearch.propTypes = {
  onResultSelect: PropTypes.func.isRequired,
}
