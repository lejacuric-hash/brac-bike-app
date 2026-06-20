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

function GpxTrails({ onTracksLoaded, selectedTrail, onStatsUpdate }) {
  const [tracks, setTracks] = useState([])
  const map = useMap()
  const gpxLayersRef = useRef([])
  const trackBoundsRef = useRef({})

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
        console.error(error)
      })

    return () => {
      mounted = false
    }
  }, [onTracksLoaded])

  useEffect(() => {
    if (!map || tracks.length === 0) {
      return
    }

    // If a trail is selected, only render that trail; otherwise render all
    const tracksToRender = selectedTrail
      ? tracks.filter((track) => track.filename === selectedTrail)
      : tracks

    const layers = tracksToRender.map((track) => {
      const color = difficultyColors[track.difficulty] ?? difficultyColors.easy
      const gpxUrl = `/tracks/${track.filename}`
      const gpxLayer = new L.GPX(gpxUrl, {
        async: true,
        marker_options: {
          startIconUrl: '',
          endIconUrl: '',
          shadowUrl: '',
        },
        polyline_options: {
          color,
          weight: 5,
          opacity: 0.85,
        },
      })

      gpxLayer.on('loaded', (event) => {
        // Remove the default start/end marker pins, keep only the polyline
        const sublayer = Object.values(event.target._layers)[0]
        if (sublayer && sublayer._layers) {
          Object.values(sublayer._layers).forEach((nested) => {
            if (typeof nested.getLatLngs !== 'function' && map.hasLayer(nested)) {
              map.removeLayer(nested)
            }
          })
        }

        const bounds = event.target.getBounds()
        trackBoundsRef.current[track.filename] = bounds

        // Extract statistics from the loaded GPX
        const rawDistance = event.target.get_distance?.() || 0
        const distance = rawDistance / 1000 // convert total route distance to km
        const elevationGain = event.target.get_elevation_gain?.() || 0
        const elevationLoss = event.target.get_elevation_loss?.() || 0
        const elevationMax = event.target.get_elevation_max?.() || 0
        const elevationMin = event.target.get_elevation_min?.() || 0
        const elevationData = event.target.get_elevation_data?.() || []

        // Get actual track coordinates from the rendered polyline
        let trackLatLngs = []
        try {
          const polylineCandidate = Object.values(sublayer._layers).find(
            (l) => typeof l.getLatLngs === 'function'
          )
          if (polylineCandidate) {
            const raw = polylineCandidate.getLatLngs()
            trackLatLngs = Array.isArray(raw[0]) ? raw.flat(Infinity) : raw
          }
        } catch (err) {
          console.warn('Could not extract coordinates from GPX:', err)
        }

        // Format elevation data for recharts, matching coordinates by proportional position
        const formattedElevationData = elevationData.map((point, index) => {
          const ratio = index / Math.max(elevationData.length - 1, 1)
          const latLngIndex = Math.round(ratio * (trackLatLngs.length - 1))
          const matched = trackLatLngs[latLngIndex]
          return {
            distance: point[0],
            elevation: point[1],
            lat: matched ? matched.lat : null,
            lng: matched ? matched.lng : null,
          }
        })

        // Report stats to parent
        if (typeof onStatsUpdate === 'function') {
          onStatsUpdate(track.filename, {
            distance,
            elevationGain,
            elevationLoss,
            elevationMax,
            elevationMin,
            elevationData: formattedElevationData,
          })
        }

        const popupContent = `
          <div>
            <strong>${track.name}</strong><br />
            Difficulty: ${track.difficulty}<br />
            ${track.description || ''}<br />
            ${track.startLocation ? `Start: ${track.startLocation}` : ''}
          </div>
        `

        event.target.bindPopup(popupContent)
      })

      gpxLayer.addTo(map)
      return gpxLayer
    })

    gpxLayersRef.current = layers

    return () => {
      layers.forEach((layer) => {
        if (layer && layer.remove) {
          layer.remove()
        }
      })
      gpxLayersRef.current = []
    }
  }, [map, tracks, selectedTrail, onStatsUpdate])

  useEffect(() => {
    if (!map || !selectedTrail) {
      return
    }

    const bounds = trackBoundsRef.current[selectedTrail]
    if (bounds) {
      map.flyToBounds(bounds, { padding: [50, 50] })
    }
  }, [map, selectedTrail])

  return null
}

GpxTrails.propTypes = {
  onTracksLoaded: PropTypes.func,
  selectedTrail: PropTypes.string,
  onStatsUpdate: PropTypes.func,
}

export default GpxTrails