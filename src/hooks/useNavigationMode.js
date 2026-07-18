import { useCallback, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import {
  angleDiffDeg,
  bearingDeg,
  findHazardsAheadOnPath,
  findLookaheadTarget,
  haversineDistanceKm,
  nearestPointOnPath,
  normalizeAngleDeg,
  totalPathDistanceKm,
} from '../utils/geo'

const LOOKAHEAD_METERS = 40
const HAZARD_CORRIDOR_METERS = 40
const HAZARD_LOOKAHEAD_KM = 0.3
const HAZARD_CHECK_THROTTLE_MS = 2000
const MIN_SPEED_FOR_GPS_HEADING = 0.5 // m/s
const MIN_FIX_DISTANCE_FOR_DELTA_HEADING_KM = 0.005 // 5m

export default function useNavigationMode() {
  const [isActive, setIsActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [userPosition, setUserPosition] = useState(null)
  const [accuracy, setAccuracy] = useState(null)
  const [userHeadingDeg, setUserHeadingDeg] = useState(null)
  const [headingSource, setHeadingSource] = useState('none')
  const [isNorthUpLocked, setIsNorthUpLocked] = useState(false)
  const [targetBearingDeg, setTargetBearingDeg] = useState(null)
  const [distanceRemainingKm, setDistanceRemainingKm] = useState(null)
  const [totalDistanceKm, setTotalDistanceKm] = useState(null)
  const [progressFraction, setProgressFraction] = useState(0)
  const [remainingPath, setRemainingPath] = useState([])
  const [activeHazardWarning, setActiveHazardWarning] = useState(null)
  const [compassPermissionState, setCompassPermissionState] = useState('unknown')

  const pathRef = useRef(null)
  const watchIdRef = useRef(null)
  const orientationHandlerRef = useRef(null)
  const orientationEventNameRef = useRef(null)
  const lastFixRef = useRef(null)
  const lastHazardCheckRef = useRef(0)
  const warnedIdsRef = useRef(new Set())
  const hazardReportsRef = useRef([])
  const headingSourceRef = useRef('none')

  // watchPosition's callback closure is registered once in start() and never
  // re-subscribed, so heading-source checks inside it must read a ref, not
  // React state, or they'd keep seeing the value from registration time.
  const setHeadingSourceTracked = useCallback((value) => {
    headingSourceRef.current = value
    setHeadingSource(value)
  }, [])

  const applyPosition = useCallback((position) => {
    const { latitude, longitude, heading, speed } = position.coords
    const point = [latitude, longitude]
    setUserPosition(point)
    setAccuracy(position.coords.accuracy)

    const path = pathRef.current
    if (path && path.length >= 2) {
      const nearest = nearestPointOnPath(path, point)
      if (nearest) {
        const total = totalPathDistanceKm(path)
        const remaining = Math.max(total - nearest.distanceAlongKm, 0)
        setTotalDistanceKm(total)
        setDistanceRemainingKm(remaining)
        setProgressFraction(total > 0 ? Math.min(nearest.distanceAlongKm / total, 1) : 0)
        setRemainingPath(path.slice(nearest.segmentIndex))

        const lookahead = findLookaheadTarget(path, nearest.distanceAlongKm, LOOKAHEAD_METERS)
        if (lookahead) {
          setTargetBearingDeg(bearingDeg(point, lookahead))
        }

        const now = Date.now()
        if (now - lastHazardCheckRef.current > HAZARD_CHECK_THROTTLE_MS) {
          lastHazardCheckRef.current = now
          const hazardsAhead = findHazardsAheadOnPath(
            path,
            hazardReportsRef.current,
            nearest.distanceAlongKm,
            { corridorMeters: HAZARD_CORRIDOR_METERS, lookaheadKm: HAZARD_LOOKAHEAD_KM }
          )
          const firstUnwarned = hazardsAhead.find((hazard) => !warnedIdsRef.current.has(hazard.id))
          if (firstUnwarned) {
            warnedIdsRef.current.add(firstUnwarned.id)
            setActiveHazardWarning(firstUnwarned)
          }
        }
      }
    }

    // Heading: prefer live compass (handled separately via orientation events).
    // Fall back to GPS course / delta-fix bearing only when compass isn't driving it.
    const currentHeadingSource = headingSourceRef.current
    if (currentHeadingSource === 'none' || currentHeadingSource === 'gps-course' || currentHeadingSource === 'gps-delta') {
      if (heading != null && speed != null && speed > MIN_SPEED_FOR_GPS_HEADING) {
        setUserHeadingDeg(normalizeAngleDeg(heading))
        setHeadingSourceTracked('gps-course')
      } else if (lastFixRef.current) {
        const distanceKm = haversineDistanceKm(lastFixRef.current, point)
        if (distanceKm > MIN_FIX_DISTANCE_FOR_DELTA_HEADING_KM) {
          setUserHeadingDeg(bearingDeg(lastFixRef.current, point))
          setHeadingSourceTracked('gps-delta')
        }
      }
    }

    lastFixRef.current = point
    setLoading(false)
  }, [setHeadingSourceTracked])

  const attachOrientationListener = useCallback(() => {
    const handleOrientation = (event) => {
      let heading = null
      if (typeof event.webkitCompassHeading === 'number') {
        heading = event.webkitCompassHeading
      } else if (event.absolute && event.alpha != null) {
        heading = 360 - event.alpha
      } else if (event.alpha != null) {
        heading = 360 - event.alpha
      }

      if (heading != null && Number.isFinite(heading)) {
        setUserHeadingDeg(normalizeAngleDeg(heading))
        setHeadingSourceTracked('compass')
      }
    }

    orientationHandlerRef.current = handleOrientation

    if ('ondeviceorientationabsolute' in window) {
      orientationEventNameRef.current = 'deviceorientationabsolute'
      window.addEventListener('deviceorientationabsolute', handleOrientation)
      setCompassPermissionState((prev) => (prev === 'unknown' ? 'granted' : prev))
    } else if ('ondeviceorientation' in window) {
      orientationEventNameRef.current = 'deviceorientation'
      window.addEventListener('deviceorientation', handleOrientation)
      setCompassPermissionState((prev) => (prev === 'unknown' ? 'granted' : prev))
    } else {
      setCompassPermissionState('unsupported')
    }
  }, [setHeadingSourceTracked])

  const setupCompass = useCallback(async () => {
    const DOE = typeof window !== 'undefined' ? window.DeviceOrientationEvent : undefined

    if (DOE && typeof DOE.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission()
        if (result === 'granted') {
          setCompassPermissionState('granted')
          attachOrientationListener()
        } else {
          setCompassPermissionState('denied')
        }
      } catch {
        setCompassPermissionState('denied')
      }
      return
    }

    if (typeof window === 'undefined' || !('ondeviceorientationabsolute' in window || 'ondeviceorientation' in window)) {
      setCompassPermissionState('unsupported')
      return
    }

    attachOrientationListener()
  }, [attachOrientationListener])

  const fetchHazardReports = useCallback(async () => {
    const { data, error } = await supabase.from('road_reports').select('*')
    if (!error && Array.isArray(data)) {
      hazardReportsRef.current = data
    }
  }, [])

  const start = useCallback((activeNavigationPath) => {
    pathRef.current = activeNavigationPath?.points || null
    warnedIdsRef.current = new Set()
    lastFixRef.current = null
    lastHazardCheckRef.current = 0
    setLoading(true)
    setIsActive(true)
    setActiveHazardWarning(null)
    setHeadingSourceTracked('none')
    setUserHeadingDeg(null)
    setIsNorthUpLocked(false)

    fetchHazardReports()
    setupCompass()

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        applyPosition,
        () => setLoading(false),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
      )
    } else {
      setLoading(false)
    }
  }, [applyPosition, fetchHazardReports, setupCompass, setHeadingSourceTracked])

  const stop = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (orientationHandlerRef.current && orientationEventNameRef.current) {
      window.removeEventListener(orientationEventNameRef.current, orientationHandlerRef.current)
      orientationHandlerRef.current = null
      orientationEventNameRef.current = null
    }

    pathRef.current = null
    hazardReportsRef.current = []
    warnedIdsRef.current = new Set()
    lastFixRef.current = null

    setIsActive(false)
    setLoading(false)
    setUserPosition(null)
    setAccuracy(null)
    setUserHeadingDeg(null)
    setHeadingSourceTracked('none')
    setIsNorthUpLocked(false)
    setTargetBearingDeg(null)
    setDistanceRemainingKm(null)
    setTotalDistanceKm(null)
    setProgressFraction(0)
    setRemainingPath([])
    setActiveHazardWarning(null)
    setCompassPermissionState('unknown')
  }, [setHeadingSourceTracked])

  const toggleNorthUpLock = useCallback(() => {
    setIsNorthUpLocked((prev) => !prev)
  }, [])

  const dismissHazardWarning = useCallback(() => {
    setActiveHazardWarning(null)
  }, [])

  const mapRotationDeg = isNorthUpLocked || userHeadingDeg == null ? 0 : userHeadingDeg
  const relativeBearingDeg = targetBearingDeg != null && userHeadingDeg != null
    ? angleDiffDeg(targetBearingDeg, userHeadingDeg)
    : targetBearingDeg

  return {
    isActive,
    start,
    stop,
    loading,
    userPosition,
    accuracy,
    userHeadingDeg,
    headingSource,
    mapRotationDeg,
    isNorthUpLocked,
    toggleNorthUpLock,
    targetBearingDeg,
    relativeBearingDeg,
    distanceRemainingKm,
    progressFraction,
    totalDistanceKm,
    remainingPath,
    activeHazardWarning,
    dismissHazardWarning,
    compassPermissionState,
  }
}
