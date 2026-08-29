import { useEffect, useState } from 'react'
import { fetchPlaceRating } from '../utils/googlePlaces'

export function usePlaceRatings(restaurants) {
  const [ratings, setRatings] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!restaurants?.length) return

    let cancelled = false

    const fetchAll = async () => {
      setLoading(true)
      const results = {}

      await Promise.all(
        restaurants
          .filter((r) => r.placeId)
          .map(async (restaurant) => {
            const cacheKey = `place_${restaurant.placeId}`
            const cached = sessionStorage.getItem(cacheKey)
            if (cached) {
              results[restaurant.id] = JSON.parse(cached)
              return
            }

            const rating = await fetchPlaceRating(restaurant.placeId)
            if (rating) {
              results[restaurant.id] = rating
              sessionStorage.setItem(cacheKey, JSON.stringify(rating))
            }
          })
      )

      if (!cancelled) {
        setRatings(results)
        setLoading(false)
      }
    }

    fetchAll()

    return () => {
      cancelled = true
    }
  }, [restaurants])

  return { ratings, loading }
}
