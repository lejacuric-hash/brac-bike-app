import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import emailjs from '@emailjs/browser'

const CATEGORY_OPTIONS = {
  restaurant: ['Traditional', 'Seafood', 'Pizza/Pasta', 'Café', 'Bar', 'Vegan/Vegetarian', 'Other'],
  farm: ['Olive Oil', 'Cheese', 'Meat', 'Vegetables', 'Wine/Drinks', 'Traditional Crafts', 'Other'],
}

const REQUIRED_FIELDS = ['businessName', 'category', 'location', 'phone', 'description', 'contactName', 'contactEmail']

const EMPTY_FORM = {
  businessName: '',
  category: '',
  location: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  hours: '',
  description: '',
  offer: '',
  contactName: '',
  contactEmail: '',
}

const DESCRIPTION_MAX_LENGTH = 300
const AUTO_CLOSE_DELAY_MS = 4000

const labelStyle = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: '#d6bcfa',
  marginBottom: '6px',
}

const requiredMarkStyle = { color: '#f87171' }

const fieldWrapperStyle = { marginBottom: '16px' }

const errorTextStyle = {
  color: '#f87171',
  fontSize: '0.75rem',
  marginTop: '4px',
}

function inputStyle(hasError) {
  return {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px',
    borderRadius: '10px',
    border: `1px solid ${hasError ? '#f87171' : 'rgba(255,255,255,0.15)'}`,
    background: 'rgba(255,255,255,0.08)',
    color: '#ffffff',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    outline: 'none',
  }
}

function RequiredLabel({ children }) {
  return (
    <label style={labelStyle}>
      {children} <span style={requiredMarkStyle}>*</span>
    </label>
  )
}

RequiredLabel.propTypes = { children: PropTypes.node.isRequired }

export default function BusinessSubmitModal({ isOpen, onClose, type }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState(null)
  const autoCloseTimerRef = useRef(null)

  const isFarm = type === 'farm'
  const categoryOptions = CATEGORY_OPTIONS[type] || CATEGORY_OPTIONS.restaurant

  // Fresh form every time the modal is (re)opened, so a prior submission's
  // data/success state doesn't linger into the next one.
  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY_FORM)
      setErrors({})
      setSending(false)
      setSent(false)
      setSendError(null)
    }
    return () => clearTimeout(autoCloseTimerRef.current)
  }, [isOpen])

  if (!isOpen) return null

  const updateField = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const handleClose = () => {
    clearTimeout(autoCloseTimerRef.current)
    onClose()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const nextErrors = {}
    REQUIRED_FIELDS.forEach((key) => {
      if (!form[key].trim()) nextErrors[key] = true
    })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSending(true)
    setSendError(null)

    try {
      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_SUBMISSION_TEMPLATE_ID,
        {
          type: isFarm ? 'Farm' : 'Restaurant',
          business_type: isFarm ? 'Farm' : 'Restaurant',
          category: form.category,
          business_name: form.businessName,
          location: form.location,
          address: form.address || 'Not provided',
          phone: form.phone,
          business_email: form.email || 'Not provided',
          website: form.website || 'Not provided',
          opening_hours: form.hours || 'Not provided',
          description: form.description,
          offer: form.offer || 'Not provided',
          contact_name: form.contactName,
          contact_email: form.contactEmail,
          reply_to: form.contactEmail,
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      )
      setSent(true)
      autoCloseTimerRef.current = setTimeout(handleClose, AUTO_CLOSE_DELAY_MS)
    } catch {
      setSendError('Could not send your submission. Please try again or email us directly at info@r-and-r.eu')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '500px',
          maxHeight: '90vh',
          background: '#1f0931',
          borderRadius: '20px 20px 0 0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Sticky header — business name is the lead field, pinned alongside close */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '20px 20px 16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            background: '#1f0931',
          }}
        >
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b794f4', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isFarm ? '🌿 Submit Your Farm' : '🍽️ Submit Your Restaurant'}
            </span>
            {!sent && (
              <>
                <div style={{ marginTop: '10px' }}>
                  <RequiredLabel>Business Name</RequiredLabel>
                  <input
                    type="text"
                    value={form.businessName}
                    onChange={updateField('businessName')}
                    placeholder={isFarm ? 'e.g. Family Farm Marinković' : 'e.g. Konoba Vinogradar'}
                    style={inputStyle(errors.businessName)}
                  />
                  {errors.businessName && <p style={errorTextStyle}>Business name is required.</p>}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            style={{
              flexShrink: 0,
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.1)',
              color: '#ffffff',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {sent ? (
          <div style={{ padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎉</div>
            <p style={{ color: '#ffffff', fontSize: '1rem', lineHeight: 1.5, margin: 0 }}>
              Thank you! We received your submission for <strong>{form.businessName}</strong>.
              {' '}We&apos;ll review it and add it to the app soon.
              {' '}We&apos;ll contact you at <strong>{form.contactEmail}</strong> if we need more info!
            </p>
          </div>
        ) : (
          <>
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              <div style={fieldWrapperStyle}>
                <RequiredLabel>Type / Category</RequiredLabel>
                <select
                  value={form.category}
                  onChange={updateField('category')}
                  style={inputStyle(errors.category)}
                >
                  <option value="">Select a category...</option>
                  {categoryOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                {errors.category && <p style={errorTextStyle}>Please select a category.</p>}
              </div>

              <div style={fieldWrapperStyle}>
                <RequiredLabel>Location / Village</RequiredLabel>
                <input
                  type="text"
                  value={form.location}
                  onChange={updateField('location')}
                  placeholder="e.g. Supetar, Bol"
                  style={inputStyle(errors.location)}
                />
                {errors.location && <p style={errorTextStyle}>Location is required.</p>}
              </div>

              <div style={fieldWrapperStyle}>
                <label style={labelStyle}>Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={updateField('address')}
                  placeholder="Street and number (optional)"
                  style={inputStyle(false)}
                />
              </div>

              <div style={fieldWrapperStyle}>
                <RequiredLabel>Phone Number</RequiredLabel>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={updateField('phone')}
                  placeholder="+385 ..."
                  style={inputStyle(errors.phone)}
                />
                {errors.phone && <p style={errorTextStyle}>Phone number is required.</p>}
              </div>

              <div style={fieldWrapperStyle}>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={updateField('email')}
                  placeholder="Business email (optional)"
                  style={inputStyle(false)}
                />
              </div>

              <div style={fieldWrapperStyle}>
                <label style={labelStyle}>Website</label>
                <input
                  type="url"
                  value={form.website}
                  onChange={updateField('website')}
                  placeholder="https://... (optional)"
                  style={inputStyle(false)}
                />
              </div>

              <div style={fieldWrapperStyle}>
                <label style={labelStyle}>Opening Hours</label>
                <input
                  type="text"
                  value={form.hours}
                  onChange={updateField('hours')}
                  placeholder="e.g. Mon-Sat 08:00-22:00"
                  style={inputStyle(false)}
                />
              </div>

              <div style={fieldWrapperStyle}>
                <RequiredLabel>Short Description</RequiredLabel>
                <textarea
                  value={form.description}
                  onChange={updateField('description')}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  rows={3}
                  placeholder="Tell us what makes it worth a stop..."
                  style={{ ...inputStyle(errors.description), resize: 'vertical', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  {errors.description ? <p style={{ ...errorTextStyle, margin: 0 }}>Description is required.</p> : <span />}
                  <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                    {form.description.length}/{DESCRIPTION_MAX_LENGTH}
                  </span>
                </div>
              </div>

              <div style={fieldWrapperStyle}>
                <label style={labelStyle}>{isFarm ? 'Products we offer' : 'Specialties'}</label>
                <textarea
                  value={form.offer}
                  onChange={updateField('offer')}
                  rows={2}
                  placeholder={isFarm ? 'e.g. Olive oil, homemade cheese, honey (optional)' : 'e.g. Fresh fish, homemade pasta (optional)'}
                  style={{ ...inputStyle(false), resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div style={fieldWrapperStyle}>
                <RequiredLabel>Contact Person Name</RequiredLabel>
                <input
                  type="text"
                  value={form.contactName}
                  onChange={updateField('contactName')}
                  placeholder="Your name"
                  style={inputStyle(errors.contactName)}
                />
                {errors.contactName && <p style={errorTextStyle}>Contact name is required.</p>}
              </div>

              <div style={fieldWrapperStyle}>
                <RequiredLabel>Contact Person Email</RequiredLabel>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={updateField('contactEmail')}
                  placeholder="For our confirmation reply"
                  style={inputStyle(errors.contactEmail)}
                />
                {errors.contactEmail && <p style={errorTextStyle}>Contact email is required.</p>}
              </div>

              {sendError && (
                <p style={{ ...errorTextStyle, textAlign: 'center', marginTop: '8px' }}>{sendError}</p>
              )}
            </div>

            <div
              style={{
                position: 'sticky',
                bottom: 0,
                padding: '16px 20px',
                paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                background: '#1f0931',
              }}
            >
              <button
                type="button"
                onClick={handleSubmit}
                disabled={sending}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '999px',
                  border: 'none',
                  background: '#753cae',
                  color: '#ffffff',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: sending ? 'default' : 'pointer',
                  opacity: sending ? 0.7 : 1,
                }}
              >
                {sending ? 'Sending...' : 'Submit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

BusinessSubmitModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  type: PropTypes.oneOf(['restaurant', 'farm']).isRequired,
}
