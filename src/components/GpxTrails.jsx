import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-gpx'

const difficultyColors = {
  easy: '#4ade80',
  medium: '#facc15',
  hard: '#f97316',
}

// selectedTrail may be passed as a plain filename string or as a trail
// object (e.g. { filename: '750_sunca.gpx' }) depending on the caller.
function getSelectedFilename(selectedTrail) {
  if (!selectedTrail) return null
  if (typeof selectedTrail === 'string') return selectedTrail
  if (typeof selectedTrail === 'object' && typeof selectedTrail.filename === 'string') {
    return selectedTrail.filename
  }
  return null
}

function GpxTrails({ onTracksLoaded, selectedTrail, onStatsUpdate }) {
  const [tracks, setTracks] = useState([])
  const map = useMap()
  
  // Keep track of loaded layers and bounds dynamically
  const activeLayersRef = useRef([])
  const trackBoundsRef = useRef({})

  // 1. Fetch tracks metadata configuration list
  useEffect(() => {
    let mounted = true

    fetch('/tracks/tracks.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load tracks.json: ${response.status}`)
        }
        return response.json()
      })
      .then((data) => {
        if (mounted) {
          setTracks(data)
          if (typeof onTracksLoaded === 'function') {
            onTracksLoaded(data)
          }
        }
      })
      .catch((error) => {
        console.error('Error fetching tracks.json:', error)
      })

    return () => {
      mounted = false
    }
  }, [onTracksLoaded])

  // 2. Clear out and rebuild route lines on selection changes
  useEffect(() => {
    if (!map || tracks.length === 0) {
      return
    }

    // CLEANUP STEP: Explicitly and cleanly tear down previous tracks from the Leaflet map
    activeLayersRef.current.forEach((layer) => {
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer)
      }
    })
    activeLayersRef.current = []

    // REQUIREMENT: If nothing is selected, do not paint any routes on the map.
    const selectedFilename = getSelectedFilename(selectedTrail)
    if (!selectedFilename) {
      return
    }

    // Filter to render ONLY the explicitly active trail
    const tracksToRender = tracks.filter((track) => track.filename === selectedFilename)

    const loadedLayers = tracksToRender
      .map((track) => {
        const color = difficultyColors[track.difficulty] ?? difficultyColors.easy
        const gpxUrl = `/tracks/${track.filename}`

        let gpxLayer
        try {
          gpxLayer = new L.GPX(gpxUrl, {
            async: true,
            marker_options: {
              startIconUrl: '',
              endIconUrl: '',
              shadowUrl: '',
            },
            polyline_options: {
              color,
              weight: 3, // REQUIREMENT: Narrower route line for a tidier map presentation
              opacity: 0.9,
            },
          })
        } catch (err) {
          console.error(`Failed to initialize GPX layer for ${track.filename}:`, err)
          return null
        }

        gpxLayer.on('error', (event) => {
          console.error(`Failed to load GPX track "${track.filename}":`, event?.err || event)
        })

        gpxLayer.on('loaded', (event) => {
          // Strip out default pin markers from leaflet-gpx, leaving only the track line
          const sublayers = event.target._layers ? Object.values(event.target._layers) : []
          const sublayer = sublayers[0]
          if (sublayer && sublayer._layers) {
            Object.values(sublayer._layers).forEach((nested) => {
              if (typeof nested.getLatLngs !== 'function' && map.hasLayer(nested)) {
                map.removeLayer(nested)
              }
            })
          }

          const bounds = event.target.getBounds?.()
          if (bounds && bounds.isValid()) {
            trackBoundsRef.current[track.filename] = bounds
            map.flyToBounds(bounds, { padding: [50, 50] })
          } else {
            console.warn(`GPX track "${track.filename}" has no valid bounds; skipping flyToBounds.`)
          }

          // Extract statistics and format elevation data with 0.1 km precision
          const rawDistance = event.target.get_distance?.() || 0
          const distance = rawDistance / 1000 // Convert to km
          const elevationGain = event.target.get_elevation_gain?.() || 0
          const elevationLoss = event.target.get_elevation_loss?.() || 0
          const elevationMax = event.target.get_elevation_max?.() || 0
          const elevationMin = event.target.get_elevation_min?.() || 0
          const elevationData = event.target.get_elevation_data?.() || []

          let trackLatLngs = []
          try {
            const nestedLayers = sublayer?._layers ? Object.values(sublayer._layers) : []
            const polylineCandidate = nestedLayers.find(
              (l) => typeof l.getLatLngs === 'function'
            )
            if (polylineCandidate) {
              const raw = polylineCandidate.getLatLngs()
              trackLatLngs = Array.isArray(raw[0]) ? raw.flat(Infinity) : raw
            }
          } catch (err) {
            console.warn('Could not extract coordinates from GPX:', err)
          }

          const formattedElevationData = elevationData.map((point, index) => {
            const ratio = index / Math.max(elevationData.length - 1, 1)
            const latLngIndex = Math.round(ratio * (trackLatLngs.length - 1))
            const matched = trackLatLngs[latLngIndex]
            return {
              distance: Number(point[0].toFixed(1)), // Standardize step precision to 0.1 km
              elevation: Math.round(point[1]),
              lat: matched ? matched.lat : null,
              lng: matched ? matched.lng : null,
            }
          })

          if (typeof onStatsUpdate === 'function') {
            onStatsUpdate(track.filename, {
              distance,
              elevationGain,
              elevationLoss,
              elevationMax,
              elevationMin,
              elevationData: formattedElevationData,
              rawPath: trackLatLngs.map((ll) => [ll.lat, ll.lng]),
            })
          }

          const popupContent = `
            <div style="font-family: sans-serif; padding: 2px;">
              <strong style="font-size: 14px;">${track.name}</strong><br />
              <span style="font-size: 11px; color: #666; font-weight: bold;">DIFFICULTY: ${(track.difficulty || '').toUpperCase()}</span>
              ${track.description ? `<p style="margin: 5px 0 0 0; font-size: 12px;">${track.description}</p>` : ''}
            </div>
          `
          event.target.bindPopup(popupContent)
        })

        try {
          gpxLayer.addTo(map)
        } catch (err) {
          console.error(`Failed to add GPX layer for ${track.filename} to map:`, err)
          return null
        }
        return gpxLayer
      })
      .filter(Boolean)

    activeLayersRef.current = loadedLayers

    // Cleanup hook when the component unmounts or state updates
    return () => {
      loadedLayers.forEach((layer) => {
        if (layer && map.hasLayer(layer)) {
          map.removeLayer(layer)
        }
      })
    }
  }, [map, tracks, selectedTrail, onStatsUpdate])

  return null
}

GpxTrails.propTypes = {
  onTracksLoaded: PropTypes.func,
  selectedTrail: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({ filename: PropTypes.string }),
  ]),
  onStatsUpdate: PropTypes.func,
}

export default GpxTrails