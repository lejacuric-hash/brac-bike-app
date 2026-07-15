import { useState, useMemo } from 'react'
import emailjs from '@emailjs/browser'
import { bikes, extras, deliveryZones, bikePricing } from '../data/bikes'
import './BookPage.css'

function calculatePrice(bike, pickupDate, dropoffDate, deliveryZone, deliveryType) {
  if (!bike || !pickupDate || !dropoffDate) return 0

  const pickup = new Date(pickupDate)
  const dropoff = new Date(dropoffDate)
  const diffMs = dropoff - pickup
  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  const pricing = bikePricing[bike.category]
  let bikePrice = 0

  if (diffDays >= 7) {
    bikePrice = pricing.multiDay[7] * Math.ceil(diffDays)
  } else if (diffDays >= 3) {
    bikePrice = pricing.multiDay[3] * Math.ceil(diffDays)
  } else if (diffHours <= 1) {
    bikePrice = pricing.hourly[1] || pricing.hourly[3]
  } else if (diffHours <= 3) {
    bikePrice = pricing.hourly[3]
  } else if (diffHours <= 6) {
    bikePrice = pricing.hourly[6]
  } else if (diffHours <= 12) {
    bikePrice = pricing.hourly[12]
  } else {
    bikePrice = pricing.hourly[24]
  }

  let deliveryPrice = 0
  if (deliveryZone && deliveryZone.id !== 'zone0') {
    deliveryPrice = deliveryType === 'bothWays'
      ? deliveryZone.bothWays
      : deliveryZone.oneWay
  }

  return bikePrice + deliveryPrice
}

export default function BookPage() {
  const [step, setStep] = useState(1)
  const [selectedBike, setSelectedBike] = useState(null)
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedExtras, setSelectedExtras] = useState([])
  const [deliveryZone, setDeliveryZone] = useState(deliveryZones[0])
  const [deliveryType, setDeliveryType] = useState('bothWays')
  const [pickupDate, setPickupDate] = useState('')
  const [pickupTime, setPickupTime] = useState('09:00')
  const [dropoffDate, setDropoffDate] = useState('')
  const [dropoffTime, setDropoffTime] = useState('09:00')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('all')

  const filteredBikes = bikes.filter(
    (b) => categoryFilter === 'all' || b.category === categoryFilter
  )

  const totalPrice = useMemo(
    () => calculatePrice(selectedBike, pickupDate + 'T' + pickupTime, dropoffDate + 'T' + dropoffTime, deliveryZone, deliveryType),
    [selectedBike, pickupDate, pickupTime, dropoffDate, dropoffTime, deliveryZone, deliveryType]
  )

  const toggleExtra = (id) => {
    setSelectedExtras((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    )
  }

  const handleSend = async () => {
    if (!name || !email || !phone || !selectedBike || !selectedSize || !pickupDate || !dropoffDate) {
      setError('Please fill in all required fields.')
      return
    }

    setSending(true)
    setError(null)

    const extrasText = selectedExtras.length > 0
      ? selectedExtras.map((id) => extras.find((e) => e.id === id)?.label).join(', ')
      : 'None'

    const deliveryText = deliveryZone.id === 'zone0'
      ? 'Pickup at our location (Supetar)'
      : `${deliveryZone.label} — ${deliveryType === 'bothWays' ? 'Both ways' : 'One way'} (€${deliveryType === 'bothWays' ? deliveryZone.bothWays : deliveryZone.oneWay})`

    try {
      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        {
          from_name: name,
          from_email: email,
          phone,
          bike_name: selectedBike.name,
          bike_type: selectedBike.type,
          size: selectedSize,
          pickup_date: pickupDate,
          pickup_time: pickupTime,
          dropoff_date: dropoffDate,
          dropoff_time: dropoffTime,
          extras: extrasText,
          delivery: deliveryText,
          total_price: `€${totalPrice}`,
          message: message || 'No additional message',
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      )
      setSent(true)
    } catch (err) {
      setError('Could not send reservation. Please email us directly at info@r-and-r.eu')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="book-page">
        <div className="book-success">
          <div className="book-success-icon">✅</div>
          <h2>Reservation Sent!</h2>
          <p>Thank you, {name}! We received your reservation request for the <strong>{selectedBike?.name}</strong>.</p>
          <p>Please check your email at <strong>{email}</strong> for confirmation. We'll be in touch shortly!</p>
          <button className="book-btn-primary" onClick={() => { setSent(false); setStep(1); setSelectedBike(null); setSelectedSize(''); }}>
            Make Another Reservation
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="book-page">
      <h1 className="book-title">Book a Bike</h1>

      <div className="book-steps">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`book-step-dot ${step >= s ? 'active' : ''}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="book-section">
          <h2 className="book-section-title">Choose Your Bike</h2>

          <div className="book-category-filter">
            {['all', 'bike', 'ebike'].map((cat) => (
              <button
                key={cat}
                type="button"
                className={`book-filter-btn ${categoryFilter === cat ? 'active' : ''}`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat === 'all' ? 'All' : cat === 'bike' ? '🚵 Bikes' : '⚡ E-Bikes'}
              </button>
            ))}
          </div>

          <div className="book-bikes-grid">
            {filteredBikes.map((bike) => (
              <div
                key={bike.id}
                className={`book-bike-card ${selectedBike?.id === bike.id ? 'selected' : ''}`}
                onClick={() => { setSelectedBike(bike); setSelectedSize('') }}
              >
                <div className="book-bike-image-container">
                  <img
                    src={bike.image}
                    alt={bike.name}
                    className="book-bike-image"
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                </div>
                <div className="book-bike-info">
                  <div className="book-bike-name">{bike.name}</div>
                  <div className="book-bike-type">{bike.type}</div>
                  <ul className="book-bike-specs">
                    {bike.specs.slice(0, 3).map((spec, i) => (
                      <li key={i}>{spec}</li>
                    ))}
                  </ul>
                  <a
                    href={bike.specUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="book-spec-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Full specs →
                  </a>
                </div>
                {selectedBike?.id === bike.id && (
                  <div className="book-bike-selected-badge">✓ Selected</div>
                )}
              </div>
            ))}
          </div>

          {selectedBike && (
            <div className="book-size-picker">
              <h3 className="book-subsection-title">Choose Size</h3>
              <div className="book-size-buttons">
                {selectedBike.sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`book-size-btn ${selectedSize === size ? 'active' : ''}`}
                    onClick={() => setSelectedSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            className="book-btn-primary"
            disabled={!selectedBike || !selectedSize}
            onClick={() => setStep(2)}
          >
            Next: Dates & Extras →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="book-section">
          <button className="book-back-btn" onClick={() => setStep(1)}>← Back</button>
          <h2 className="book-section-title">Dates & Extras</h2>

          <div className="book-selected-summary">
            <strong>{selectedBike?.name}</strong> · Size {selectedSize}
          </div>

          <div className="book-dates">
            <div className="book-field">
              <label>Pickup Date *</label>
              <input
                type="date"
                className="book-input"
                value={pickupDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setPickupDate(e.target.value)}
              />
            </div>
            <div className="book-field">
              <label>Pickup Time *</label>
              <input
                type="time"
                className="book-input"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
              />
            </div>
            <div className="book-field">
              <label>Drop-off Date *</label>
              <input
                type="date"
                className="book-input"
                value={dropoffDate}
                min={pickupDate || new Date().toISOString().split('T')[0]}
                onChange={(e) => setDropoffDate(e.target.value)}
              />
            </div>
            <div className="book-field">
              <label>Drop-off Time *</label>
              <input
                type="time"
                className="book-input"
                value={dropoffTime}
                onChange={(e) => setDropoffTime(e.target.value)}
              />
            </div>
          </div>

          <h3 className="book-subsection-title">Extras (all free)</h3>
          <div className="book-extras">
            {extras.map((extra) => (
              <button
                key={extra.id}
                type="button"
                className={`book-extra-btn ${selectedExtras.includes(extra.id) ? 'active' : ''}`}
                onClick={() => toggleExtra(extra.id)}
              >
                {selectedExtras.includes(extra.id) ? '✓ ' : ''}{extra.label}
              </button>
            ))}
          </div>

          <h3 className="book-subsection-title">Delivery</h3>
          <div className="book-field">
            <label>Delivery Zone</label>
            <select
              className="book-input"
              value={deliveryZone.id}
              onChange={(e) => setDeliveryZone(deliveryZones.find((z) => z.id === e.target.value))}
            >
              {deliveryZones.map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.label}</option>
              ))}
            </select>
          </div>

          {deliveryZone.id !== 'zone0' && (
            <div className="book-delivery-type">
              <button
                type="button"
                className={`book-delivery-btn ${deliveryType === 'oneWay' ? 'active' : ''}`}
                onClick={() => setDeliveryType('oneWay')}
              >
                One Way (€{deliveryZone.oneWay})
              </button>
              <button
                type="button"
                className={`book-delivery-btn ${deliveryType === 'bothWays' ? 'active' : ''}`}
                onClick={() => setDeliveryType('bothWays')}
              >
                Both Ways (€{deliveryZone.bothWays})
              </button>
            </div>
          )}

          {pickupDate && dropoffDate && (
            <div className="book-price-preview">
              <span>Estimated Total</span>
              <strong>€{totalPrice}</strong>
            </div>
          )}

          <button
            className="book-btn-primary"
            disabled={!pickupDate || !dropoffDate}
            onClick={() => setStep(3)}
          >
            Next: Your Details →
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="book-section">
          <button className="book-back-btn" onClick={() => setStep(2)}>← Back</button>
          <h2 className="book-section-title">Your Details</h2>

          <div className="book-selected-summary">
            <strong>{selectedBike?.name}</strong> · Size {selectedSize}<br />
            {pickupDate} {pickupTime} → {dropoffDate} {dropoffTime}<br />
            {deliveryZone.id !== 'zone0' && `Delivery: ${deliveryType === 'bothWays' ? 'Both ways' : 'One way'} · `}
            <strong>Total: €{totalPrice}</strong>
          </div>

          <div className="book-field">
            <label>Full Name *</label>
            <input
              type="text"
              className="book-input"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="book-field">
            <label>Email *</label>
            <input
              type="email"
              className="book-input"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="book-field">
            <label>Phone *</label>
            <input
              type="tel"
              className="book-input"
              placeholder="+385..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="book-field">
            <label>Additional Message</label>
            <textarea
              className="book-input book-textarea"
              placeholder="Any special requests or questions..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>

          {error && <div className="book-error">{error}</div>}

          <button
            className="book-btn-primary"
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? 'Sending...' : '📧 Send Reservation'}
          </button>

          <p className="book-note">
            After sending, check your email for confirmation. We'll reply to finalize your booking.
          </p>
        </div>
      )}
    </div>
  )
}