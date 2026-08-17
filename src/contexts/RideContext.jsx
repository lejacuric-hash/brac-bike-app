import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { useWakeLock } from '../hooks/useWakeLock'
import { useBackgroundGps } from '../hooks/useBackgroundGps'
import { useRideNotification } from '../hooks/useRideNotification'
import useNavigationMode from '../hooks/useNavigationMode'
import { haversineDistanceKm, speedKmh } from '../utils/geo'

const RideContext = createContext(null)

export function RideProvider({ children }) {
  const [activeRecording, setActiveRecording] = useState(false)
  const [navigationModeActive, setNavigationModeActive] = useState(false)
  // The active route (GPX/community path) being followed, plus the whole
  // turn-by-turn hook (position, remaining path, heading, hazards — and its
  // own background GPS watch). Both live here rather than in TrailsPage so a
  // navigation session survives switching tabs and back — TrailsPage's map
  // is a fresh instance each remount, but its declarative Source/Marker JSX
  // re-renders correctly as soon as this (never-reset) state is available
  // again, with no separate re-hydration step needed.
  const [activeNavigationPath, setActiveNavigationPath] = useState(null)
  const nav = useNavigationMode()
  const [gpsTrackPoints, setGpsTrackPoints] = useState([])
  const [currentPosition, setCurrentPosition] = useState(null)
  const [rideStartTime, setRideStartTime] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [totalDistance, setTotalDistance] = useState(0)
  const [currentSpeed, setCurrentSpeed] = useState(0)
  const timerRef = useRef(null)

  // Wake lock keeps screen on during rides (web/PWA only — native Android's
  // background-geolocation notification/foreground service covers this there).
  useWakeLock(activeRecording || navigationModeActive)

  const handlePosition = useCallback((position) => {
    setCurrentPosition(position)

    if (activeRecording) {
      setGpsTrackPoints((prev) => {
        if (prev.length > 0) {
          const last = prev[prev.length - 1]
          const dist = haversineDistanceKm([last.lat, last.lng], [position.lat, position.lng])
          setTotalDistance((d) => d + dist)
          setCurrentSpeed(speedKmh(last, position))
        }
        return [...prev, position]
      })
    }
  }, [activeRecording])

  // Throttled to once/10s — see useRideNotification and useBackgroundGps for
  // why (the background-geolocation plugin has no in-place notification
  // update, only remove-and-recreate).
  const { notificationTitle: rideNotificationTitle, notificationText: rideNotificationText } = useRideNotification({
    active: activeRecording,
    distance: totalDistance,
    elapsedTime: elapsedSeconds,
    speed: currentSpeed,
  })

  const { hasPermission, permissionDenied } = useBackgroundGps({
    active: activeRecording || navigationModeActive,
    onPosition: handlePosition,
    onError: (err) => console.warn('GPS error:', err),
    notificationTitle: activeRecording ? rideNotificationTitle : 'Brač Bike — Navigation active',
    notificationText: activeRecording ? rideNotificationText : 'Tracking your ride...',
  })

  const startRecording = useCallback(() => {
    setActiveRecording(true)
    setGpsTrackPoints([])
    setTotalDistance(0)
    setElapsedSeconds(0)
    setRideStartTime(Date.now())

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1)
    }, 1000)
  }, [])

  const stopRecording = useCallback(() => {
    setActiveRecording(false)
    setCurrentSpeed(0)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startNavigation = useCallback(() => {
    setNavigationModeActive(true)
    if (!activeRecording) {
      startRecording()
    }
  }, [activeRecording, startRecording])

  const stopNavigation = useCallback(() => {
    setNavigationModeActive(false)
  }, [])

  const resetRide = useCallback(() => {
    setGpsTrackPoints([])
    setTotalDistance(0)
    setElapsedSeconds(0)
    setCurrentSpeed(0)
    setRideStartTime(null)
    setActiveRecording(false)
    setNavigationModeActive(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  return (
    <RideContext.Provider value={{
      activeRecording,
      navigationModeActive,
      gpsTrackPoints,
      currentPosition,
      rideStartTime,
      elapsedSeconds,
      totalDistance,
      currentSpeed,
      hasPermission,
      permissionDenied,
      nav,
      activeNavigationPath,
      setActiveNavigationPath,
      startRecording,
      stopRecording,
      startNavigation,
      stopNavigation,
      resetRide,
    }}>
      {children}
    </RideContext.Provider>
  )
}

export const useRide = () => {
  const ctx = useContext(RideContext)
  if (!ctx) throw new Error('useRide must be used inside RideProvider')
  return ctx
}
