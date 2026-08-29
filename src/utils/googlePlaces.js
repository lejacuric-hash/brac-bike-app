const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY

export async function fetchPlaceRating(placeId) {
  if (!placeId || !GOOGLE_PLACES_KEY) return null

  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?fields=rating,userRatingCount,googleMapsUri&key=${GOOGLE_PLACES_KEY}`
    )
    if (!response.ok) return null
    const data = await response.json()
    return {
      rating: data.rating || null,
      reviewCount: data.userRatingCount || 0,
      googleMapsUrl: data.googleMapsUri || null,
    }
  } catch {
    return null
  }
}
