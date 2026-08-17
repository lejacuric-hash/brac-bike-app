import { useEffect, useRef, useState } from 'react'

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

// @capacitor-community/background-geolocation has no API to update a running
// watcher's notification text in place — the only way is to remove and
// re-add the watcher with new options (see useBackgroundGps), which briefly
// interrupts tracking. So rather than push a new value on every GPS fix,
// this throttles to once per UPDATE_INTERVAL_MS and returns the formatted
// text for the caller to feed into useBackgroundGps's own
// notificationTitle/notificationText, which only restarts the watcher when
// those actually change. 10s keeps the notification's live stats fresh
// while still keeping watcher restarts infrequent enough not to affect
// tracking reliability.
const UPDATE_INTERVAL_MS = 10000

export function useRideNotification({ active, distance, elapsedTime, speed = 0 }) {
  const latestRef = useRef({ distance, elapsedTime, speed })
  latestRef.current = { distance, elapsedTime, speed }

  const [stats, setStats] = useState({ distance, elapsedTime, speed })

  useEffect(() => {
    if (!active) return undefined

    setStats(latestRef.current)
    const interval = setInterval(() => {
      setStats(latestRef.current)
    }, UPDATE_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [active])

  return {
    notificationTitle: 'Brač Bike — Ride in progress',
    notificationText: `📍 ${stats.distance.toFixed(2)} km · ⏱ ${formatTime(stats.elapsedTime)} · ⚡ ${stats.speed.toFixed(1)} km/h`,
  }
}
