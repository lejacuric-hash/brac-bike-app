import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { supabase } from '../supabaseClient'

const PROBLEM_TYPES = [
  { value: 'damaged', label: '🚧 Damaged road' },
  { value: 'flooded', label: '💧 Flooded path' },
  { value: 'narrow', label: '⚠️ Too narrow for bikes' },
  { value: 'fallen_tree', label: '🌲 Fallen tree blocking path' },
  { value: 'landslide', label: '🪨 Landslide / rocks on path' },
  { value: 'other', label: '🔧 Other' },
]

const ReportProblem = forwardRef(function ReportProblem({ onReportSaved, initialCoordinates, onRequestDropPin }, ref) {
  const [open, setOpen] = useState(false)
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [photoFile, setPhotoFile] = useState(null)

  useImperativeHandle(ref, () => ({
    openModal: (coords) => {
      setOpen(true)
      if (coords) {
        setLatitude(coords.lat.toFixed(6))
        setLongitude(coords.lng.toFixed(6))
      }
    },
  }))
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [type, setType] = useState(PROBLEM_TYPES[0].value)
  const [description, setDescription] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!initialCoordinates) return
    setLatitude(initialCoordinates.lat.toFixed(6))
    setLongitude(initialCoordinates.lng.toFixed(6))
  }, [initialCoordinates])

  const resetForm = () => {
    setType(PROBLEM_TYPES[0].value)
    setDescription('')
    setLatitude('')
    setLongitude('')
    setPhotoFile(null)
    setError(null)
  }

  const handleCancel = () => {
    setOpen(false)
    resetForm()
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not available on this device')
      return
    }

    setError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6))
        setLongitude(position.coords.longitude.toFixed(6))
      },
      () => {
        setError('Could not get your location. Please enable location access.')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleDropPinOnMap = () => {
    setError(null)
    setOpen(false)
    if (typeof onRequestDropPin === 'function') {
      onRequestDropPin()
    }
  }

  const handleSubmit = async () => {
    const lat = Number(latitude)
    const lng = Number(longitude)

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError('Please provide valid latitude and longitude values.')
      return
    }

    setSubmitting(true)
    setError(null)

    let photoReference = null

    if (photoFile) {
      const fileExt = photoFile.name.split('.').pop() || 'jpg'
      const filePath = `reports/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('road-report-photos')
        .upload(filePath, photoFile)

      if (uploadError) {
        setSubmitting(false)
        setError('Photo upload failed: ' + uploadError.message)
        return
      }

      const { data: publicData } = supabase.storage.from('road-report-photos').getPublicUrl(filePath)
      photoReference = publicData?.publicUrl || filePath
    }

    const composedDescription = [
      description?.trim() || null,
      photoReference ? `Photo: ${photoReference}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const { error: insertError } = await supabase.from('road_reports').insert([
      {
        lat,
        lng,
        type,
        description: composedDescription || null,
      },
    ])

    setSubmitting(false)

    if (insertError) {
      setError('Could not submit report: ' + insertError.message)
      return
    }

    setSuccess(true)
    if (typeof onReportSaved === 'function') {
      onReportSaved()
    }

    setTimeout(() => {
      setSuccess(false)
      setOpen(false)
      resetForm()
    }, 2000)
  }

  return (
    <>
      {open && (
        <div className="report-modal-overlay" onClick={handleCancel}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            {success ? (
              <div className="report-success">Report submitted! Thank you 🙏</div>
            ) : (
              <>
                <h3>Report a Problem</h3>

                <label className="report-label" htmlFor="problem-type">
                  Type of problem
                </label>
                <select
                  id="problem-type"
                  className="report-select"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {PROBLEM_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <label className="report-label">Coordinates</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <button
                    type="button"
                    className="report-cancel-button"
                    onClick={handleUseCurrentLocation}
                    disabled={submitting}
                    style={{ flex: 1 }}
                  >
                    Use Current Location
                  </button>
                  <button
                    type="button"
                    className="report-submit-button"
                    onClick={handleDropPinOnMap}
                    disabled={submitting}
                    style={{ flex: 1 }}
                  >
                    Drop Pin on Map
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    className="report-select"
                    type="number"
                    step="any"
                    placeholder="Latitude"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                  />
                  <input
                    className="report-select"
                    type="number"
                    step="any"
                    placeholder="Longitude"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                  />
                </div>

                <label className="report-label" htmlFor="problem-description">
                  Add details (optional)
                </label>
                <textarea
                  id="problem-description"
                  className="report-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />

                <label className="report-label" htmlFor="problem-photo">
                  Photo (optional)
                </label>
                <input
                  id="problem-photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                />

                {error && <div className="report-error">{error}</div>}

                <div className="report-actions">
                  <button
                    type="button"
                    className="report-submit-button"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                  <button
                    type="button"
                    className="report-cancel-button"
                    onClick={handleCancel}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
})

export default ReportProblem