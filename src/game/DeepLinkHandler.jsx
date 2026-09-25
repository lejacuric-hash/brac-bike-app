import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { parseGameLink } from './config'
import { getState, initGameStore, resolveQrCode } from './store'
import { getStop } from './structure'

// Opens the game at the right stop when a QR board is scanned with the normal
// phone camera (Android App Link https://<domain>/g/<code>). The stop page
// then checks the code with the server once the team is inside the radius.
async function openGameLink(code, navigate) {
  await initGameStore()
  if (!navigator.onLine) {
    navigate('/game?notice=deepLinkOffline')
    return
  }
  let stopId = null
  try {
    stopId = await resolveQrCode(code)
  } catch {
    navigate('/game?notice=deepLinkOffline')
    return
  }
  if (!stopId || !getStop(stopId)) {
    navigate('/game?notice=deepLinkUnknown')
    return
  }
  if (!getState().player) {
    navigate('/game?notice=deepLinkNoPlayer')
    return
  }
  navigate(`/game/stop/${stopId}?qr=${encodeURIComponent(code)}`)
}

export default function DeepLinkHandler() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined
    const handle = (url) => {
      const code = parseGameLink(url)
      if (code) openGameLink(code, navigate)
    }
    App.getLaunchUrl().then((launch) => launch?.url && handle(launch.url)).catch(() => {})
    const listener = App.addListener('appUrlOpen', ({ url }) => handle(url))
    return () => {
      listener.then((l) => l.remove())
    }
  }, [navigate])

  return null
}
