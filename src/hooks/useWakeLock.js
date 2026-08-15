import { useEffect } from 'react'

export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let wakeLock = null

    const requestWakeLock = async () => {
      try {
        wakeLock = await navigator.wakeLock.request('screen')
      } catch (err) {
        console.warn('Wake lock failed:', err)
      }
    }

    requestWakeLock()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      wakeLock?.release()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [active])
}
