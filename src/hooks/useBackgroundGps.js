import { useState, useEffect, useRef, useCallback } from 'react'
import { registerPlugin } from '@capacitor/core'

// Detect if running as Capacitor native app
const isNative = () => {
  return typeof window !== 'undefined' &&
    window.Capacitor?.isNativePlatform?.() === true
}

// @capacitor-community/background-geolocation ships no JS module of its own
// (its package.json has no main/module/exports — only native Android/iOS
// code plus TypeScript defs), so it can't be dynamically import()'d the way
// most Capacitor plugins can; bundlers choke trying to resolve an entry that
// doesn't exist. It's meant to be consumed through Capacitor's own plugin
// registry instead, keyed by the name it registers natively under (see its
// README). registerPlugin() is safe to call unconditionally here — it just
// returns a proxy; methods only need a native implementation once actually
// called, which only happens inside the isNative() branches below.
const BackgroundGeolocation = registerPlugin('BackgroundGeolocation')

export function useBackgroundGps({
  onPosition,
  onError,
  active = false,
  notificationTitle = 'Brač Bike',
  notificationText = 'Tracking your ride...'
}) {
  // Native watcher id (from addWatcher) vs. web's watchPosition id — the two
  // platforms use unrelated id spaces so they're tracked separately.
  const watcherIdRef = useRef(null)
  const webWatchIdRef = useRef(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const requestPermissions = useCallback(async () => {
    if (isNative()) {
      // The plugin exposes no standalone permission-check/request call —
      // addWatcher's own `requestPermissions: true` option handles the
      // prompt, and denial is reported back through its callback's error
      // (code "NOT_AUTHORIZED") rather than up front here.
      return true
    }
    // Web - use standard geolocation API
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => { setHasPermission(true); resolve(true) },
        () => { setPermissionDenied(true); resolve(false) }
      )
    })
  }, [])

  useEffect(() => {
    if (!active) {
      // Stop tracking
      if (isNative()) {
        if (watcherIdRef.current != null) {
          BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current })
          watcherIdRef.current = null
        }
      } else if (webWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(webWatchIdRef.current)
        webWatchIdRef.current = null
      }
      return undefined
    }

    let cancelled = false

    // Start tracking
    const startTracking = async () => {
      await requestPermissions()
      if (cancelled) return

      if (isNative()) {
        const id = await BackgroundGeolocation.addWatcher(
          {
            backgroundTitle: notificationTitle,
            backgroundMessage: notificationText, // presence of this is what keeps updates flowing while backgrounded
            requestPermissions: true,
            stale: false,
            distanceFilter: 5, // meters between updates
          },
          (location, error) => {
            if (error) {
              if (error.code === 'NOT_AUTHORIZED') {
                setPermissionDenied(true)
              } else {
                onError?.(error)
              }
              return
            }
            if (!location) return
            setHasPermission(true)
            onPosition({
              lat: location.latitude,
              lng: location.longitude,
              altitude: location.altitude || 0,
              accuracy: location.accuracy,
              speed: location.speed || 0,
              heading: location.bearing || 0,
              timestamp: location.time,
            })
          }
        )

        if (cancelled) {
          BackgroundGeolocation.removeWatcher({ id })
        } else {
          watcherIdRef.current = id
        }
      } else {
        // Web fallback
        webWatchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            onPosition({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              altitude: position.coords.altitude || 0,
              accuracy: position.coords.accuracy,
              speed: position.coords.speed || 0,
              heading: position.coords.heading || 0,
              timestamp: position.timestamp,
            })
          },
          (err) => onError?.(err),
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 2000
          }
        )
      }
    }

    startTracking()

    return () => {
      cancelled = true
      if (isNative()) {
        if (watcherIdRef.current != null) {
          BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current })
          watcherIdRef.current = null
        }
      } else if (webWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(webWatchIdRef.current)
        webWatchIdRef.current = null
      }
    }
  }, [active, notificationTitle, notificationText, onPosition, onError, requestPermissions])

  return { hasPermission, permissionDenied, requestPermissions }
}
