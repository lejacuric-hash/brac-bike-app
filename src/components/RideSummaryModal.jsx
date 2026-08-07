import { useEffect, useMemo, useRef, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../supabaseClient'

const CHART_COLOR = '#3b82f6'
const STAR_COUNT = 5

function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0m'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.round((totalSeconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function StatTile({ label, value }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.06)',
        borderRadius: '12px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      <span style={{ fontSize: '0.75rem', color: '#b794f4', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </span>
      <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>{value}</span>
    </div>
  )
}

function RideElevationChart({ data }) {
  if (!Array.isArray(data) || data.length === 0) return null

  return (
    <div style={{ marginTop: '16px' }}>
      <h4 style={{ color: '#ffffff', margin: '0 0 8px', fontSize: '0.95rem' }}>Elevation Profile</h4>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="rideSummaryElevationGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLOR} stopOpacity={0.8} />
              <stop offset="95%" stopColor={CHART_COLOR} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.18} />
          <XAxis
            dataKey="distance"
            stroke="#f8fafc"
            tick={{ fill: '#f8fafc', fontSize: 12 }}
            label={{ value: 'Distance (km)', position: 'insideBottomRight', offset: -5, fill: '#f8fafc' }}
          />
          <YAxis
            stroke="#f8fafc"
            tick={{ fill: '#f8fafc', fontSize: 12 }}
            label={{ value: 'Elevation (m)', angle: -90, position: 'insideLeft', fill: '#f8fafc' }}
          />
          <RechartsTooltip
            contentStyle={{ backgroundColor: '#1f0931', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px' }}
            labelStyle={{ color: '#f8fafc' }}
            itemStyle={{ color: '#f8fafc' }}
            formatter={(value) => [Number(value).toFixed(0) + ' m', 'Elevation']}
          />
          <Area type="monotone" dataKey="elevation" stroke={CHART_COLOR} fillOpacity={1} fill="url(#rideSummaryElevationGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function RideSummaryModal({ stats, onSave, onDiscard, isOpen }) {
  const [rating, setRating] = useState(0)
  const [review, setReview] = useState('')
  const [photos, setPhotos] = useState([])
  const [saving, setSaving] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)

  const photoPreviews = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos])
  useEffect(() => () => {
    photoPreviews.forEach((url) => URL.revokeObjectURL(url))
  }, [photoPreviews])

  if (!isOpen || !stats) return null

  const movingTimeHours = stats.movingTime / 3600
  const avgSpeedKmh = movingTimeHours > 0 ? stats.totalDistance / movingTimeHours : 0

  const handlePhotoChange = (event) => {
    const files = Array.from(event.target.files || [])
    if (files.length > 0) {
      setPhotos((prev) => [...prev, ...files])
    }
    event.target.value = ''
  }

  const removePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setSaving(true)
    setUploadError(null)

    try {
      const photoUrls = []
      for (const file of photos) {
        const path = `rides/${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase.storage.from('ride-photos').upload(path, file)
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('ride-photos').getPublicUrl(path)
        if (data?.publicUrl) photoUrls.push(data.publicUrl)
      }

      await onSave({ rating, review, photoUrls })
    } catch (err) {
      setUploadError('Could not save ride: ' + err.message)
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: '#1f0931',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: '#ffffff', margin: '0 0 8px', fontSize: '1.4rem' }}>🏁 Ride Complete!</h2>
          <div style={{ color: CHART_COLOR, fontSize: '2.2rem', fontWeight: 800 }}>
            {stats.totalDistance.toFixed(1)} km
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <StatTile label="Elapsed Time" value={formatDuration(stats.elapsedTime)} />
          <StatTile label="Moving Time" value={formatDuration(stats.movingTime)} />
          <StatTile label="Distance" value={`${stats.totalDistance.toFixed(1)} km`} />
          <StatTile label="Elevation Gain" value={`${Math.round(stats.elevationGain)} m`} />
          <StatTile label="Max Elevation" value={`${Math.round(stats.maxElevation)} m`} />
          <StatTile label="Avg Speed" value={`${avgSpeedKmh.toFixed(1)} km/h`} />
        </div>

        <RideElevationChart data={stats.elevationProfile} />

        <div style={{ marginTop: '20px' }}>
          <span style={{ fontSize: '0.85rem', color: '#b794f4', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Rate this ride
          </span>
          <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
            {Array.from({ length: STAR_COUNT }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '30px',
                  lineHeight: 1,
                  padding: 0,
                  color: n <= rating ? '#facc15' : 'rgba(255,255,255,0.25)',
                }}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '14px' }}>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Write a review (optional)"
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.06)',
              color: '#ffffff',
              padding: '10px 12px',
              fontSize: '0.9rem',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ marginTop: '14px' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoChange}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: '#753cae',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 14px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            📷 Add Photos
          </button>

          {photos.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
              {photoPreviews.map((url, index) => (
                <div key={url} style={{ position: 'relative' }}>
                  <img
                    src={url}
                    alt=""
                    style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: '10px', display: 'block' }}
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    aria-label="Remove photo"
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: 'none',
                      background: '#dc2626',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      lineHeight: 1,
                      cursor: 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {uploadError && (
          <div style={{ marginTop: '12px', color: '#fca5a5', fontSize: '0.85rem' }}>{uploadError}</div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1,
              background: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '12px',
              fontWeight: 700,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
              fontSize: '0.95rem',
            }}
          >
            {saving ? 'Saving…' : '💾 Save Ride'}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.08)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '10px',
              padding: '12px',
              fontWeight: 700,
              cursor: saving ? 'default' : 'pointer',
              fontSize: '0.95rem',
            }}
          >
            🗑️ Discard
          </button>
        </div>
      </div>
    </div>
  )
}
