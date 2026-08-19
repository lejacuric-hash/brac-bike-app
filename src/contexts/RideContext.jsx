import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { useWakeLock } from '../hooks/useWakeLock'
import { useBackgroundGps } from '../hooks/useBackgroundGps'
import { useRideNotification } from '../hooks/useRideNotification'
import useNavigationMode from '../hooks/useNavigationMode'
import { haversineDistanceKm } from '../utils/geo'

const RideContext = createContext(null)

const ACTIVE_RIDE_STORAGE_KEY = 'activeRide'
const ACTIVE_RIDE_SAVE_INTERVAL_MS = 10000
const ACTIVE_RIDE_MAX_RESUME_AGE_MS = 5 * 60 * 1000

// Instantaneous point-to-point speed is noisy — a single close-together or
// jittery GPS fix can swing it to 0 or spike it for a frame. Averaging over
// the last few intervals (rather than just the latest two points) smooths
// that out without lagging the display too far behind reality.
// Below this, consecutive fixes are indistinguishable from stationary GPS
// drift, so treat the movement as noise rather than real distance.
const MIN_MOVEMENT_DISTANCE_KM = 0.003 // 3 meters

function calculateRollingSpeed(points) {
  if (points.length < 3) return 0

  const recent = points.slice(-6)
  const speeds = []

  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1]
    const curr = recent[i]
    if (!prev?.timestamp || !curr?.timestamp) continue

    const timeDiffSec = (curr.timestamp - prev.timestamp) / 1000
    if (timeDiffSec <= 0 || timeDiffSec > 30) continue // skip gaps > 30s

    const distKm = haversineDistanceKm([prev.lat, prev.lng], [curr.lat, curr.lng])
    if (distKm < MIN_MOVEMENT_DISTANCE_KM) continue // too small to be real movement

    const speed = (distKm / timeDiffSec) * 3600

    // Filter out GPS noise (ignore speeds > 120 km/h on a bike)
    if (speed >= 0 && speed < 120) {
      speeds.push(speed)
    }
  }

  if (speeds.length === 0) return 0
  return speeds.reduce((a, b) => a + b, 0) / speeds.length
}

// GPS fixes this imprecise are too noisy to trust for speed, though still
// fine to show as a rough position marker.
const MAX_USABLE_ACCURACY_M = 25

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
  // Gate display updates so a single noisy rolling-average sample can't make
  // the stats bar flicker every fix — only move the shown value when it's
  // changed meaningfully or gone stale.
  const lastSpeedValue = useRef(0)
  const lastSpeedUpdate = useRef(0)

  // Wake lock keeps screen on during rides (web/PWA only — native Android's
  // background-geolocation notification/foreground service covers this there).
  useWakeLock(activeRecording || navigationModeActive)

  const handlePosition = useCallback((position) => {
    // Still show the position marker even on a poor fix, but don't let it
    // feed the speed calculation — that's where bad accuracy shows up as
    // phantom movement.
    if (position.accuracy && position.accuracy > MAX_USABLE_ACCURACY_M) {
      setCurrentPosition(position)
      return
    }

    setCurrentPosition(position)

    if (activeRecording) {
      setGpsTrackPoints((prev) => {
        const updated = [...prev, position]

        if (prev.length > 0) {
          const last = prev[prev.length - 1]
          const dist = haversineDistanceKm([last.lat, last.lng], [position.lat, position.lng])
          setTotalDistance((d) => d + dist)
        }

        // Native GPS speed (Doppler-derived) is more accurate than deriving
        // it from consecutive coordinates — prefer it when the platform
        // provides it, falling back to the rolling average otherwise.
        const hasNativeSpeed = position.speed !== null && position.speed !== undefined && position.speed >= 0
        const newSpeed = hasNativeSpeed ? position.speed * 3.6 : calculateRollingSpeed(updated)

        const now = Date.now()
        if (Math.abs(newSpeed - lastSpeedValue.current) > 0.5 || now - lastSpeedUpdate.current > 3000) {
          setCurrentSpeed(newSpeed)
          lastSpeedValue.current = newSpeed
          lastSpeedUpdate.current = now
        }

        return updated
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
    lastSpeedValue.current = 0
    lastSpeedUpdate.current = 0

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
    try {
      localStorage.removeItem(ACTIVE_RIDE_STORAGE_KEY)
    } catch {
      // localStorage may be unavailable
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
    try {
      localStorage.removeItem(ACTIVE_RIDE_STORAGE_KEY)
    } catch {
      // localStorage may be unavailable
    }
  }, [])

  // Android can kill and restart the WebView process when it's backgrounded
  // (camera, other apps) to free RAM, which would otherwise silently wipe an
  // in-progress ride. Back it up periodically so a killed/reloaded app can
  // recover it.
  useEffect(() => {
    if (!activeRecording) return undefined

    const saveInterval = setInterval(() => {
      try {
        localStorage.setItem(ACTIVE_RIDE_STORAGE_KEY, JSON.stringify({
          gpsTrackPoints,
          totalDistance,
          elapsedSeconds,
          rideStartTime,
          savedAt: Date.now(),
        }))
      } catch {
        // localStorage might be full or unavailable
      }
    }, ACTIVE_RIDE_SAVE_INTERVAL_MS)

    return () => clearInterval(saveInterval)
  }, [activeRecording, gpsTrackPoints, totalDistance, elapsedSeconds, rideStartTime])

  // On load, offer to resume a ride that was in progress when the app was
  // last killed/reloaded, as long as the backup isn't too stale to be useful.
  useEffect(() => {
    let saved
    try {
      saved = localStorage.getItem(ACTIVE_RIDE_STORAGE_KEY)
    } catch {
      return
    }
    if (!saved) return

    let ride
    try {
      ride = JSON.parse(saved)
    } catch {
      localStorage.removeItem(ACTIVE_RIDE_STORAGE_KEY)
      return
    }

    const age = Date.now() - (ride.savedAt || 0)
    if (age > ACTIVE_RIDE_MAX_RESUME_AGE_MS || !Array.isArray(ride.gpsTrackPoints) || ride.gpsTrackPoints.length === 0) {
      localStorage.removeItem(ACTIVE_RIDE_STORAGE_KEY)
      return
    }

    const resume = window.confirm(
      `Your last ride recording (${(ride.totalDistance || 0).toFixed(1)} km) was interrupted. Resume it?`
    )
    localStorage.removeItem(ACTIVE_RIDE_STORAGE_KEY)
    if (!resume) return

    setGpsTrackPoints(ride.gpsTrackPoints)
    setTotalDistance(ride.totalDistance || 0)
    setElapsedSeconds(ride.elapsedSeconds || 0)
    setRideStartTime(ride.rideStartTime || Date.now())
    setActiveRecording(true)

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1)
    }, 1000)
    // Only meant to run once, on mount, to recover from an OS-triggered reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
