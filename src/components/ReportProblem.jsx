import { forwardRef, useImperativeHandle, useState } from 'react'
import { supabase } from '../supabaseClient'

const PROBLEM_TYPES = [
  { value: 'damaged', label: '🚧 Damaged road' },
  { value: 'flooded', label: '💧 Flooded path' },
  { value: 'narrow', label: '⚠️ Too narrow for bikes' },
  { value: 'fallen_tree', label: '🌲 Fallen tree blocking path' },
  { value: 'landslide', label: '🪨 Landslide / rocks on path' },
  { value: 'other', label: '🔧 Other' },
]

const ReportProblem = forwardRef(function ReportProblem({ onReportSaved }, ref) {
  const [open, setOpen] = useState(false)

  useImperativeHandle(ref, () => ({
    openModal: () => setOpen(true),
  }))
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [type, setType] = useState(PROBLEM_TYPES[0].value)
  const [description, setDescription] = useState('')
  const [error, setError] = useState(null)

  const handleOpen = () => {
    setError(null)
    setOpen(true)
  }

  const handleCancel = () => {
    setOpen(false)
    setType(PROBLEM_TYPES[0].value)
    setDescription('')
    setError(null)
  }

  const handleSubmit = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not available on this device')
      return
    }

    setSubmitting(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords

        const { error: insertError } = await supabase.from('road_reports').insert([
          {
            lat: latitude,
            lng: longitude,
            type,
            description: description || null,
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
          setType(PROBLEM_TYPES[0].value)
          setDescription('')
        }, 2000)
      },
      () => {
        setSubmitting(false)
        setError('Could not get your location. Please enable location access.')
      }
    )
  }

  return (
    <>
      <button type="button" className="report-problem-button" onClick={handleOpen}>
        ⚠️ Report Problem
      </button>

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