import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

// Pastir Loda: transparent WebP drawings in public/loda/.
//   default – smiling, leaning on his staff (everywhere)
//   sad     – wrong answer on the stop screen
//   happy   – only in the finale celebration
// If a file fails to load, falls back to loda-default.webp.
const DEFAULT_SRC = '/loda/loda-default.webp'

// anim: 'peek' | 'hop' | 'sad' | 'jump' — CSS animations using only
// transform, opacity and filter; switched off under prefers-reduced-motion.
// Change animKey to replay the same animation.
export default function Loda({ mood = 'default', anim = null, animKey = 0, className = '' }) {
  const src = `/loda/loda-${mood}.webp`
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])

  return (
    <img
      key={`${anim}-${animKey}`}
      src={failed ? DEFAULT_SRC : src}
      alt="Pastir Loda"
      className={`loda${anim ? ` loda--${anim}` : ''} ${className}`}
      draggable={false}
      onError={() => {
        if (src !== DEFAULT_SRC) setFailed(true)
      }}
    />
  )
}

Loda.propTypes = {
  mood: PropTypes.oneOf(['default', 'happy', 'sad']),
  anim: PropTypes.oneOf(['peek', 'hop', 'sad', 'jump', null]),
  animKey: PropTypes.number,
  className: PropTypes.string,
}
