import { useCallback, useRef, useState } from 'react'
import PropTypes from 'prop-types'

// Mirrors the key fallback chain in TrailsPage.jsx / MapSearch.jsx so search keeps
// working even if only one of the two env var names is configured on the host.
const MAPTILER_FALLBACK_KEY = 'TjtNydvQmJJGJOelz7ji'
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_API_KEY || import.meta.env.VITE_MAPTILER_KEY || MAPTILER_FALLBACK_KEY

// Controlled like a plain <input>: the parent owns `value` (so it can also be
// updated by a map tap / reverse geocode) and this component only layers a
// debounced suggestions dropdown on top.
export default function PlaceSearchInput({ placeholder = '', value, onChange, onSelect, icon = '📍' }) {
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
      // Wider than the map bbox — routes can reasonably start/end off-island (e.g. a ferry port).
      const response = await fetch(
        `https://api.maptiler.com/geocoding/${encodeURIComponent(text)}.json` +
        `?key=${MAPTILER_KEY}` +
        `&bbox=15.8,42.9,17.5,43.7` +
        `&language=en,hr` +
        `&limit=5`
      )
      const data = await response.json()
      setResults(data.features || [])
      setShowResults(true)
    } catch {
      // Suggestions are a convenience; silently fail and let the user keep typing.
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInput = (e) => {
    const text = e.target.value
    onChange(text)

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(text), 300)
  }

  const handleSelect = (result) => {
    const name = result.place_name || result.text
    setShowResults(false)
    setResults([])

    const [lng, lat] = result.center || result.geometry.coordinates
    onSelect({ lat, lng, name })
  }

  const handleClear = () => {
    onChange('')
    setResults([])
    setShowResults(false)
  }

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: '40px',
        background: 'rgba(15, 23, 42, 0.4)',
        border: '1px solid rgba(148, 163, 184, 0.25)',
        borderRadius: showResults && results.length > 0 ? '10px 10px 0 0' : '10px',
        padding: '0 12px',
        gap: 8,
      }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
        <input
          type="text"
          value={value}
          onChange={handleInput}
          placeholder={placeholder}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#f8fafc',
            fontSize: '0.9rem',
            fontFamily: 'inherit',
          }}
        />
        {loading && (
          <span style={{ color: 'rgba(248,250,252,0.4)', fontSize: 11, flexShrink: 0 }}>...</span>
        )}
        {value && !loading && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(248,250,252,0.4)',
              cursor: 'pointer',
              fontSize: 14,
              padding: 0,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#1f0931',
          border: '1px solid rgba(117,60,174,0.4)',
          borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          zIndex: 50,
          maxHeight: 200,
          overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {results.map((result, i) => (
            <button
              key={result.id || i}
              type="button"
              onClick={() => handleSelect(result)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                color: '#ffffff',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
              }}
            >
              <span style={{ flexShrink: 0 }}>📍</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {result.text || result.place_name?.split(',')[0]}
                </div>
                <div style={{
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 11,
                  marginTop: 1,
                }}>
                  {result.place_name}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults && results.length === 0 && !loading && value.length > 2 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#1f0931',
          border: '1px solid rgba(117,60,174,0.4)',
          borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          padding: '10px 12px',
          color: 'rgba(255,255,255,0.5)',
          fontSize: 13,
          zIndex: 50,
        }}>
          No places found
        </div>
      )}
    </div>
  )
}

PlaceSearchInput.propTypes = {
  placeholder: PropTypes.string,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  icon: PropTypes.string,
}
