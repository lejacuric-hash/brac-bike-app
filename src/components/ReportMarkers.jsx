import { useEffect, useState } from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../supabaseClient'

function timeAgo(iso) {
  const then = new Date(iso).getTime()
  const diff = Math.floor((Date.now() - then) / 1000)
  if (diff < 60) return `${diff} sec ago`
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
  return `${Math.floor(diff / 86400)} days ago`
}

const warningIcon = L.divIcon({
  html: '<div style="font-size:20px;line-height:20px">⚠️</div>',
  className: '',
  iconSize: [24, 24],
})

function ReportMarkers({ refreshKey = 0 }) {
  const [reports, setReports] = useState([])

  useEffect(() => {
    const loadReports = async () => {
      const { data, error } = await supabase
        .from('road_reports')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to load reports:', error)
        setReports([])
        return
      }

      setReports(data || [])
    }

    loadReports()
  }, [refreshKey])

  if (!reports || reports.length === 0) return null

  return (
    <>
      {reports.map((r) => (
        <Marker key={r.id} position={[r.lat, r.lng]} icon={warningIcon}>
          <Popup>
            <div style={{ minWidth: 160 }}>
              <strong>{r.type}</strong>
              {r.description ? <div style={{ marginTop: 6 }}>{r.description}</div> : null}
              <div style={{ marginTop: 8, color: '#94a3b8' }}>{timeAgo(r.created_at)}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  )
}

export default ReportMarkers
