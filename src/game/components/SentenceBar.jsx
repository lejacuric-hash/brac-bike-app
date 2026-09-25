import { forwardRef } from 'react'
import PropTypes from 'prop-types'
import { isUnitUnlocked, SENTENCE, UNITS } from '../structure'
import Glyph from './Glyph'

// Nazor's sentence as 64 Glagolitic letter slots, grouped by word. Every slot
// always holds its glyph; it only shows once the letter is collected (or when
// LetterFlight lands a letter on it, before the state catches up).
// Slots are found by LetterFlight via data-letter.
const SentenceBar = forwardRef(function SentenceBar({ collected, t, words, sticky = false, compact = false, showCount = true }, ref) {
  const has = (l) => collected.includes(l)

  const latin = SENTENCE.map(({ letters, punct }) => ({
    text: letters.map((l) => (has(l) ? l.toLowerCase() : '·')).join(''),
    punct,
  }))
  if (latin[0].text[0] !== '·') latin[0].text = latin[0].text[0].toUpperCase() + latin[0].text.slice(1)

  const enOf = (word) => words.find((w) => w.word === word)?.en ?? ''

  return (
    <section ref={ref} className={`sentence${sticky ? ' sentence--sticky' : ''}${compact ? ' sentence--compact' : ''}`}>
      {!compact && (
        <div className="sentence-head">
          <span className="sentence-title">{t('sentence.title')}</span>
          {showCount && <span className="sentence-count">{t('sentence.count', { n: collected.length })}</span>}
        </div>
      )}
      <div className="sentence-line" aria-label={t('sentence.title')}>
        {SENTENCE.map(({ word, letters, punct }, wi) => (
          <span key={wi} className={`sentence-word${letters.every(has) ? ' sentence-word--done' : ''}`}>
            {letters.map((l, li) => (
              <span key={li} className={`slot${has(l) ? ' slot--filled' : ''}`} data-letter={l} aria-hidden="true">
                <Glyph letter={l} className="slot-glyph" />
              </span>
            ))}
            {punct && <span className="sentence-punct">{punct}</span>}
            <span className="sr-only">{word}</span>
          </span>
        ))}
      </div>
      {!compact && (
        <>
          <p className="sentence-latin">
            {latin.map((w, i) => (
              <span key={i}>
                {[...w.text].map((ch, j) => (ch === '·' ? <span key={j} className="sentence-dot">·</span> : ch))}
                {w.punct}{' '}
              </span>
            ))}
          </p>
          <p className="sentence-en">
            {UNITS.map((u, i) => (
              <span key={i}>
                {isUnitUnlocked(u, collected) ? enOf(u.word) : <span className="sentence-dot">…</span>}
                {u.punct}{' '}
              </span>
            ))}
          </p>
        </>
      )}
    </section>
  )
})

SentenceBar.propTypes = {
  collected: PropTypes.arrayOf(PropTypes.string).isRequired,
  t: PropTypes.func.isRequired,
  words: PropTypes.arrayOf(PropTypes.object).isRequired,
  sticky: PropTypes.bool,
  compact: PropTypes.bool,
  showCount: PropTypes.bool,
}

export default SentenceBar
