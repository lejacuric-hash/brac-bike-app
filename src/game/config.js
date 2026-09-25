// Domain the QR boards point to: https://<GAME_LINK_DOMAIN>/g/<code>.
// TODO: set the real domain. It must match gameLinkHost in
// android/app/build.gradle (manifestPlaceholders), and that domain must serve
// /.well-known/assetlinks.json for Android App Links to open the app directly.
export const GAME_LINK_DOMAIN = 'example.com'

export const gameLinkUrl = (code) => `https://${GAME_LINK_DOMAIN}/g/${code}`

// Matches /g/<code> on the configured domain (or any domain, for testing)
export function parseGameLink(url) {
  try {
    const { pathname } = new URL(url)
    const match = pathname.match(/^\/g\/([A-Za-z0-9]{6,})\/?$/)
    return match ? match[1].toUpperCase() : null
  } catch {
    return null
  }
}
