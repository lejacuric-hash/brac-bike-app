import { useCallback, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import './TrailsPage.css'
import '../App.css'
import GpxTrails from '../components/GpxTrails'
import GpsTracker from '../components/GpsTracker'
import BottomSheet from '../components/BottomSheet'
import ReportMarkers from '../components/ReportMarkers'
import ReportProblem from '../components/ReportProblem'

export default function TrailsPage() {
  const [trails, setTrails] = useState([])
  const [selectedTrail, setSelectedTrail] = useState(null)
  const [trailStats, setTrailStats] = useState({})
  const [hoverPosition, setHoverPosition] = useState(null)
  const [reportsRefreshKey, setReportsRefreshKey] = useState(0)

  const handleTrailClick = useCallback((trail) => {
    setSelectedTrail(trail.filename)
  }, [])

  const handleStatsUpdate = useCallback((filename, stats) => {
    setTrailStats((prev) => ({ ...prev, [filename]: stats }))
  }, [])

  const handleChartHover = useCallback((point) => {
    setHoverPosition(point)
  }, [])

  return (
    <div className="app-container">
      <div className="main-content">
        <div className="map-wrapper">
          <MapContainer center={[43.307, 16.635]} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap contributors' />
            <GpxTrails onTracksLoaded={setTrails} selectedTrail={selectedTrail} onStatsUpdate={handleStatsUpdate} />
            <ReportMarkers refreshKey={reportsRefreshKey} />
            <GpsTracker />
            {hoverPosition && hoverPosition.lat != null && hoverPosition.lng != null && (
              <CircleMarker center={[hoverPosition.lat, hoverPosition.lng]} radius={8} pathOptions={{ color: '#ffffff', fillColor: '#4ade80', fillOpacity: 1, weight: 2 }}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1} sticky>
                  <div style={{ color: '#0f172a', fontWeight: 700 }}>
                    {hoverPosition.distance != null ? `${hoverPosition.distance.toFixed(2)} km` : ''}
                    {hoverPosition.elevation != null ? ` · ${Math.round(hoverPosition.elevation)} m` : ''}
                  </div>
                </Tooltip>
              </CircleMarker>
            )}
          </MapContainer>
          <ReportProblem onReportSaved={() => setReportsRefreshKey((k) => k + 1)} />
        </div>

        <BottomSheet
          trails={trails}
          selectedTrail={selectedTrail}
          trailStats={trailStats}
          onTrailClick={handleTrailClick}
          onChartHover={handleChartHover}
        />
      </div>
    </div>
  )
}
