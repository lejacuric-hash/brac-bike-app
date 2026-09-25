import PropTypes from 'prop-types'
import { glagoliticSrc } from '../structure'

// A Glagolitic letter from public/glagolitic/<file>.svg. The SVGs are plain
// black shapes, so they are used as a CSS mask and painted with the current
// text colour (gold in the game).
export default function Glyph({ letter, className = '' }) {
  return (
    <span
      className={`glyph ${className}`}
      style={{ '--glyph': `url("${glagoliticSrc(letter)}")` }}
      role="img"
      aria-label={letter}
    />
  )
}

Glyph.propTypes = {
  letter: PropTypes.string.isRequired,
  className: PropTypes.string,
}
