import PropTypes from 'prop-types'
import { ALL_LETTERS } from '../structure'
import Glyph from './Glyph'

// Loda's key: the 20 Glagolitic letters of the sentence with their Latin
// letter. Unlocks at the first stop the player completes (answers.md).
export default function LodaKey({ t, collected }) {
  const letters = [...ALL_LETTERS].sort((a, b) => a.localeCompare(b, 'hr'))
  return (
    <details className="loda-key">
      <summary>{t('hub.key')}</summary>
      <div className="loda-key-grid">
        {letters.map((l) => (
          <div key={l} className={`loda-key-cell${collected.includes(l) ? ' loda-key-cell--have' : ''}`}>
            <Glyph letter={l} className="loda-key-glyph" />
            <span className="loda-key-latin">{l}</span>
          </div>
        ))}
      </div>
    </details>
  )
}

LodaKey.propTypes = {
  t: PropTypes.func.isRequired,
  collected: PropTypes.arrayOf(PropTypes.string).isRequired,
}
