import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import Loda from './Loda'

const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2
  const distance = 120 + (i % 3) * 30
  return { dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance, delay: (i % 5) * 0.2 }
})

// Full-screen finale celebration: happy Loda jumping in a gold glow with
// sparks, the whole sentence, and a button on to the grand prize.
// The only place loda-happy.webp is used.
export default function Celebration({ title, sentence, buttonLabel, onClose }) {
  const buttonRef = useRef(null)
  useEffect(() => {
    buttonRef.current?.focus()
  }, [])

  return createPortal(
    <div className="celebration" role="dialog" aria-modal="true" aria-label={title}>
      <div className="celebration-card">
        {SPARKS.map((s, i) => (
          <span
            key={i}
            className="celebration-spark"
            style={{ '--dx': `${s.dx}px`, '--dy': `${s.dy}px`, animationDelay: `${s.delay}s` }}
          />
        ))}
        <Loda mood="happy" anim="jump" className="celebration-loda" />
        <p className="celebration-laugh">{title}</p>
        <p className="celebration-sentence">{sentence}</p>
        <button ref={buttonRef} type="button" className="lc-button lc-button--gold" onClick={onClose}>
          {buttonLabel}
        </button>
      </div>
    </div>,
    document.body
  )
}

Celebration.propTypes = {
  title: PropTypes.string.isRequired,
  sentence: PropTypes.string.isRequired,
  buttonLabel: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
}
