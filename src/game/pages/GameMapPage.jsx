import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import Map, { Layer, Marker, Source } from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useRide } from '../../contexts/RideContext'
import { useBackgroundGps } from '../../hooks/useBackgroundGps'
import { MAPTILER_STREET_STYLE_URL } from '../../utils/mapStyle'
import { getStop, stopsOfGame } from '../structure'
import { formatDuration } from '../i18n'
import { recordExactSpotHint } from '../store'
import { circleFeature, searchArea } from '../area'
import { fetchRouteOptions, googleMapsUrl } from '../routing'
import { isStopFound, useGame } from '../useGame'
import '../fonts'
import '../Game.css'

export default function GameMapPage() {
  const { stopId } = useParams()
  const game = useGame()
  const stop = getStop(stopId)

  if (!stop) return <Navigate to="/game" replace />
  if (!game.state.loaded) return <div className="lc-page" />
  if (!game.state.player) return <Navigate to="/game" replace />
  return <StopMap key={stopId} stop={stop} {...game} />
}

function StopMap({ stop, state, t, content }) {
  const stopId = stop.id
  const name = content.stops[stopId].name
  const location = state.stops[stopId]
  const result = state.results[stopId]
  const found = isStopFound(result)
  const seed = state.player.id
  const routerNavigate = useNavigate()
  const { startNavigation, nav, setActiveNavigationPath } = useRide()
  const mapRef = useRef(null)

  // --- Live position
  const [position, setPosition] = useState(null)
  const handlePosition = useCallback((p) => setPosition(p), [])
  const { permissionDenied } = useBackgroundGps({
    active: true,
    onPosition: handlePosition,
    notificationTitle: content.title,
    notificationText: t('map.title'),
  })

  // --- Where the map points and where the bike route ends. Until the stop is
  // found only a search area (500–800 m, randomly offset) is shown.
  const area = useMemo(
    () => (location ? searchArea(`${seed}:${stopId}`, location.lat, location.lng) : null),
    [location, seed, stopId]
  )
  const hasTrailhead = location?.on_foot && location.trailhead_lat != null && location.trailhead_lng != null
  const destination = hasTrailhead
    ? { lat: location.trailhead_lat, lng: location.trailhead_lng }
    : found
      ? { lat: location.lat, lng: location.lng }
      : area && { lat: area.lat, lng: area.lng }
  const destinationKey = destination ? `${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}` : ''

  // --- Route alternatives (fetched once we know where the team is)
  const [routes, setRoutes] = useState(null)
  const [routesError, setRoutesError] = useState(null)
  const [selected, setSelected] = useState(0)
  const firstPositionRef = useRef(null)
  if (position && !firstPositionRef.current) firstPositionRef.current = position
  const hasPosition = !!position

  useEffect(() => {
    if (!hasPosition || !destinationKey) return undefined
    const controller = new AbortController()
    const [lat, lng] = destinationKey.split(',').map(Number)
    setRoutes(null)
    setRoutesError(null)
    setSelected(0)
    fetchRouteOptions(firstPositionRef.current, { lat, lng }, controller.signal)
      .then(setRoutes)
      .catch((err) => {
        if (err.name !== 'AbortError') setRoutesError(t('map.routesError'))
      })
    return () => controller.abort()
  }, [hasPosition, destinationKey, t])

  // --- Other stops of this game: done ones exactly, the rest as area centres
  const otherStops = stopsOfGame(stop.game)
    .filter((s) => s.id !== stopId)
    .map((s) => {
      const loc = state.stops[s.id]
      if (!loc) return null
      const r = state.results[s.id]
      const done = !!r?.completed_at || !!r?.answered_correctly
      const point = done || isStopFound(r) ? loc : searchArea(`${seed}:${s.id}`, loc.lat, loc.lng)
      return { id: s.id, name: content.stops[s.id].name, done, lat: point.lat, lng: point.lng }
    })
    .filter(Boolean)

  // --- Fit the view once: team + target
  const fittedRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || fittedRef.current || !area) return
    const target = found ? [location.lng, location.lat] : [area.lng, area.lat]
    const points = [target]
    if (position) points.push([position.lng, position.lat])
    const lngs = points.map((p) => p[0])
    const lats = points.map((p) => p[1])
    map.fitBounds(
      [[Math.min(...lngs) - 0.005, Math.min(...lats) - 0.005], [Math.max(...lngs) + 0.005, Math.max(...lats) + 0.005]],
      { padding: 60, maxZoom: 14, duration: 800 }
    )
    if (position) fittedRef.current = true
  }, [mapReady, area, found, location, position])

  const revealExactSpot = () => {
    if (window.confirm(t('map.confirmExact'))) recordExactSpotHint(stopId)
  }

  const startGameNavigation = () => {
    const route = routes?.[selected]
    if (!route) return
    const pathEntry = {
      source: 'game',
      name,
      points: route.points,
      returnTo: `/game/stop/${stopId}`,
      returnLabel: t('map.returnToStop'),
    }
    setActiveNavigationPath(pathEntry)
    startNavigation()
    nav.start(pathEntry)
    routerNavigate('/trails')
  }

  if (!location || !area) return <Navigate to={`/game/stop/${stopId}`} replace />

  const routeFeatures = {
    type: 'FeatureCollection',
    features: (routes || []).map((r, i) => ({
      type: 'Feature',
      properties: { selected: i === selected },
      geometry: { type: 'LineString', coordinates: r.points.map(([lat, lng]) => [lng, lat]) },
    })),
  }

  return (
    <div className="lc-page lc-page--map">
      <div className="lc-map">
        <Map
          ref={mapRef}
          mapLib={maplibregl}
          mapStyle={MAPTILER_STREET_STYLE_URL}
          initialViewState={{ latitude: area.lat, longitude: area.lng, zoom: 13 }}
          style={{ width: '100%', height: '100%' }}
          attributionControl={false}
          onLoad={() => setMapReady(true)}
        >
          {!found && (
            <Source id="search-area" type="geojson" data={circleFeature(area.lat, area.lng, area.radiusM)}>
              <Layer id="search-area-fill" type="fill" paint={{ 'fill-color': '#d4a23a', 'fill-opacity': 0.2 }} />
              <Layer id="search-area-line" type="line" paint={{ 'line-color': '#d4a23a', 'line-width': 2, 'line-dasharray': [2, 2] }} />
            </Source>
          )}

          <Source id="game-routes" type="geojson" data={routeFeatures}>
            <Layer
              id="game-routes-other"
              type="line"
              filter={['==', ['get', 'selected'], false]}
              paint={{ 'line-color': '#9a86b8', 'line-width': 4, 'line-opacity': 0.7 }}
            />
            <Layer
              id="game-routes-selected"
              type="line"
              filter={['==', ['get', 'selected'], true]}
              paint={{ 'line-color': '#753cae', 'line-width': 6 }}
            />
          </Source>

          {otherStops.map((s) => (
            <Marker key={s.id} latitude={s.lat} longitude={s.lng} anchor="center">
              <div className={`map-stop-dot${s.done ? ' map-stop-dot--done' : ''}`} title={s.name} />
            </Marker>
          ))}

          {hasTrailhead && (
            <Marker latitude={location.trailhead_lat} longitude={location.trailhead_lng} anchor="bottom">
              <div className="map-pin map-pin--trailhead">🚲</div>
            </Marker>
          )}

          {found ? (
            <Marker latitude={location.lat} longitude={location.lng} anchor="bottom">
              <div className="map-pin">
                <span className="map-pin-label">{name}</span>
                <span className="map-pin-head">✦</span>
              </div>
            </Marker>
          ) : (
            <Marker latitude={area.lat} longitude={area.lng} anchor="center">
              <div className="map-area-label">{t('map.searchArea')}</div>
            </Marker>
          )}

          {position && (
            <Marker latitude={position.lat} longitude={position.lng} anchor="center">
              <div className="map-me" />
            </Marker>
          )}
        </Map>
      </div>

      <div className="lc-shell">
        <Link to={`/game/stop/${stopId}`} className="lc-back">{t('back')}</Link>
        <h1 className="lc-title lc-title--sc">{name}</h1>

        <div className="map-legend">
          <span><i className="map-stop-dot map-stop-dot--done" /> {t('map.legendDone')}</span>
          <span><i className="map-stop-dot" /> {t('map.legendTodo')}</span>
        </div>

        {location.on_foot && (
          <section className="lc-card lc-card--gold">
            <h2 className="lc-h2">🥾 {t('map.onFoot')}</h2>
            <p className="lc-text">{t('map.onFootNote')}</p>
          </section>
        )}

        <section className="lc-card">
          <h2 className="lc-h2">{t('map.routes')}</h2>
          {hasTrailhead ? (
            <p className="lc-muted">{t('map.toTrailhead')}</p>
          ) : !found ? (
            <p className="lc-muted">{t('map.toArea')}</p>
          ) : null}

          {permissionDenied ? (
            <p className="lc-error">{t('stop.gpsDenied')}</p>
          ) : !position ? (
            <p className="lc-muted">{t('map.noPosition')}</p>
          ) : routesError ? (
            <p className="lc-error">{routesError}</p>
          ) : !routes ? (
            <p className="lc-muted">{t('map.loadingRoutes')}</p>
          ) : (
            <div className="route-options">
              {routes.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  className={`route-option${i === selected ? ' active' : ''}`}
                  onClick={() => setSelected(i)}
                >
                  <span className="route-option-tags">{r.tags.map((tag) => t(`map.${tag}`)).join(' · ') || '—'}</span>
                  <span className="route-option-stats">
                    {r.distanceKm.toFixed(1)} km · {formatDuration(r.durationSec)}
                    {r.ascentM != null && ` · ${t('map.ascent', { m: Math.round(r.ascentM) })}`}
                  </span>
                </button>
              ))}
            </div>
          )}

          <button type="button" className="lc-button lc-button--gold" onClick={startGameNavigation} disabled={!routes?.length}>
            ▶ {t('map.startNavigation')}
          </button>
          {destination && (
            <a href={googleMapsUrl(destination)} target="_blank" rel="noopener noreferrer" className="lc-button lc-button--ghost">
              {t('map.openGoogleMaps')}
            </a>
          )}
        </section>

        {!found && (
          <section className="lc-card">
            <button type="button" className="lc-button lc-button--ghost" onClick={revealExactSpot}>
              📍 {t('map.showExact')}
            </button>
            <p className="lc-muted">{t('map.hintNote')}</p>
          </section>
        )}
      </div>
    </div>
  )
}

StopMap.propTypes = {
  stop: PropTypes.object.isRequired,
  state: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
  content: PropTypes.object.isRequired,
}
