import { useEffect, useState } from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../supabaseClient'
import { extractReportPhoto } from '../utils/reportPhoto'

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
      {reports.map((r) => {
        const { photoUrl, text } = extractReportPhoto(r)
        return (
          <Marker key={r.id} position={[r.lat, r.lng]} icon={warningIcon}>
            <Popup>
              <div
                style={{
                  background: '#370063',
                  color: '#ffffff',
                  borderRadius: '12px',
                  padding: '12px',
                  minWidth: '200px',
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                <strong style={{ fontSize: 14 }}>{r.type}</strong>
                {text ? (
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 }}>{text}</div>
                ) : null}
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4 }}>
                  {timeAgo(r.created_at)}
                </div>
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Report photo"
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      marginTop: '8px',
                      maxHeight: '150px',
                      objectFit: 'cover',
                    }}
                  />
                ) : null}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}

export default ReportMarkers
