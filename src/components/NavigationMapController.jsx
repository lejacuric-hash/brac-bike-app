import { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'

const INTERACTION_HANDLERS = [
  'dragging',
  'scrollWheelZoom',
  'doubleClickZoom',
  'touchZoom',
  'boxZoom',
  'keyboard',
  'tap',
]

function buildPuckIcon(rotationDeg) {
  return L.divIcon({
    html: `<div style="
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: rotate(${rotationDeg}deg);
    ">
      <div style="
        width: 0;
        height: 0;
        border-left: 9px solid transparent;
        border-right: 9px solid transparent;
        border-bottom: 20px solid #0ea5e9;
        filter: drop-shadow(0 2px 3px rgba(2,6,23,0.5));
      "></div>
    </div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

function NavigationMapController({ isActive, userPosition, headingDeg, mapRotationDeg, remainingPath }) {
  const map = useMap()
  const hasCenteredRef = useRef(false)

  useEffect(() => {
    if (!isActive || !map) return undefined

    INTERACTION_HANDLERS.forEach((handler) => {
      if (map[handler]) map[handler].disable()
    })

    // The rotate wrapper resizes the map's DOM container (to an oversized
    // square so rotation never exposes blank corners); Leaflet only tracks
    // size via its own resize handling and won't notice a plain CSS/layout
    // resize on its own, so tiles would stay clipped to the old viewport
    // size without an explicit invalidateSize() nudge.
    const raf = requestAnimationFrame(() => map.invalidateSize({ animate: false }))

    return () => {
      cancelAnimationFrame(raf)
      INTERACTION_HANDLERS.forEach((handler) => {
        if (map[handler]) map[handler].enable()
      })
      requestAnimationFrame(() => map.invalidateSize({ animate: false }))
    }
  }, [isActive, map])

  useEffect(() => {
    if (!isActive) {
      hasCenteredRef.current = false
    }
  }, [isActive])

  useEffect(() => {
    if (!isActive || !userPosition || !map) return

    if (!hasCenteredRef.current) {
      hasCenteredRef.current = true
      map.flyTo(userPosition, 17, { animate: true, duration: 1.2 })
    } else {
      map.panTo(userPosition, { animate: true, duration: 0.5 })
    }
  }, [isActive, userPosition, map])

  if (!isActive || !userPosition) return null

  // Counter-rotate the puck against the ambient map rotation so it always
  // visually points at true heading, whether the map itself is currently
  // heading-up or forced north-up.
  const puckRotation = (headingDeg ?? 0) - (mapRotationDeg ?? 0)

  return (
    <>
      <Marker position={userPosition} icon={buildPuckIcon(puckRotation)} interactive={false} />
      {Array.isArray(remainingPath) && remainingPath.length > 1 && (
        <Polyline
          positions={remainingPath}
          pathOptions={{ color: '#22d3ee', weight: 5, opacity: 0.9 }}
        />
      )}
    </>
  )
}

NavigationMapController.propTypes = {
  isActive: PropTypes.bool,
  userPosition: PropTypes.arrayOf(PropTypes.number),
  headingDeg: PropTypes.number,
  mapRotationDeg: PropTypes.number,
  remainingPath: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
}

export default NavigationMapController
