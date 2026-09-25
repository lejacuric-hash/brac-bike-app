// Shared by the Trails page map and the game's navigation map.

// Fallback keeps the map working in production if the env var isn't configured on the host.
const MAPTILER_FALLBACK_KEY = 'TjtNydvQmJJGJOelz7ji'
export const MAPTILER_API_KEY = import.meta.env.VITE_MAPTILER_API_KEY || import.meta.env.VITE_MAPTILER_KEY || MAPTILER_FALLBACK_KEY
if (!import.meta.env.VITE_MAPTILER_API_KEY && !import.meta.env.VITE_MAPTILER_KEY) {
  console.error('VITE_MAPTILER_API_KEY is not set; falling back to the built-in MapTiler key.')
}
const MAPTILER_STYLE_ID = '019fd2b1-1969-70ee-bdd2-bceb14957863'
export const MAPTILER_STREET_STYLE_URL = `https://api.maptiler.com/maps/${MAPTILER_STYLE_ID}/style.json?key=${MAPTILER_API_KEY}`
export const MAPTILER_SATELLITE_STYLE_URL = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_API_KEY}`
