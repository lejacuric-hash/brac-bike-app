import { useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Reorder } from 'motion/react'
import { ALL_LETTERS, UNITS } from '../structure'
import { refreshClaims, requestFinale } from '../store'
import { useGame } from '../useGame'
import SentenceBar from '../components/SentenceBar'
import Parchment from '../components/Parchment'
import Loda from '../components/Loda'
import PrizeCard from '../components/PrizeCard'
import Celebration from '../components/Celebration'
import RichText from '../components/RichText'
import { SyncBanner } from '../components/Bits'
import '../fonts'
import '../Game.css'

const ALL_WORDS = UNITS.map((u) => u.word)

function shuffled(words, seed) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const out = [...words]
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
    const j = h % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  // never start in the solved order
  return out.every((w, i) => w === words[i]) ? [...out.slice(1), out[0]] : out
}

export default function FinalePage() {
  const { state, lang, t, content, collected } = useGame()
  const pool0 = useMemo(() => shuffled(ALL_WORDS, state.player?.id || 'loda'), [state.player?.id])
  const [placed, setPlaced] = useState([])
  const [showHint, setShowHint] = useState(false)
  const [wrong, setWrong] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const prizeRef = useRef(null)

  if (!state.loaded) return <div className="lc-page" />
  if (!state.player) return <Navigate to="/game" replace />

  const hasAll = ALL_LETTERS.every((l) => collected.includes(l))
  const solved = !!(state.player.finale_completed_at || state.player._pendingFinale)
  const pool = pool0.filter((w) => !placed.includes(w))

  const place = (word) => { setWrong(false); setPlaced((p) => [...p, word]) }
  const unplace = (word) => { setWrong(false); setPlaced((p) => p.filter((w) => w !== word)) }
  const check = () => {
    if (placed.every((w, i) => w === content.finale.order[i])) {
      requestFinale()
      refreshClaims()
      setCelebrating(true)
    } else {
      setWrong(true)
    }
  }

  return (
    <div className="lc-page">
      <div className="lc-shell">
        <Link to="/game" className="lc-back">{t('back')}</Link>
        <h1 className="lc-title">{content.finale.title}</h1>
        <SyncBanner state={state} t={t} />

        {!hasAll ? (
          <>
            <SentenceBar collected={collected} t={t} words={content.words} />
            <p className="lc-text">{t('finale.notReady')}</p>
          </>
        ) : !solved ? (
          <>
            <p className="lc-text">{t('finale.instruction')}</p>

            <Reorder.Group axis="y" values={placed} onReorder={setPlaced} className="tiles-placed">
              {placed.map((word, i) => (
                <Reorder.Item key={word} value={word} className="tile tile--placed" whileDrag={{ scale: 1.05 }}>
                  <span className="tile-index">{i + 1}</span>
                  <span className="tile-word">{word}</span>
                  <button type="button" className="tile-remove" onClick={() => unplace(word)} aria-label="×">×</button>
                </Reorder.Item>
              ))}
            </Reorder.Group>

            <div className="tiles-pool">
              {pool.map((word) => (
                <button key={word} type="button" className="tile" onClick={() => place(word)}>{word}</button>
              ))}
            </div>

            {wrong && <p className="lc-error">{t('finale.wrongOrder')}</p>}
            <div className="lc-button-row">
              <button type="button" className="lc-button lc-button--ghost" onClick={() => { setPlaced([]); setWrong(false) }}>
                {t('finale.clear')}
              </button>
              <button type="button" className="lc-button lc-button--gold" onClick={check} disabled={placed.length !== ALL_WORDS.length}>
                {t('finale.check')}
              </button>
            </div>

            <button type="button" className="lc-button lc-button--ghost" onClick={() => setShowHint(true)}>
              💡 {t('finale.hintButton')}
            </button>
            {showHint && (
              <div className="stage stage--hint">
                <Loda anim="peek" className="stage-loda" />
                <Parchment paragraphs={[content.finale.hint]} signature={t('signature')} className="parchment--message" />
              </div>
            )}
          </>
        ) : (
          <>
            <SentenceBar collected={collected} t={t} words={content.words} />
            <p className="finale-sentence"><em>{content.finale.sentence}</em></p>
            <p className="finale-translation"><em>{content.finale.translation}</em></p>

            <Parchment title={t('finale.lastLetter')} paragraphs={content.finale.lodaLastLetter} />

            <div ref={prizeRef}>
              <PrizeCard level={3} state={state} t={t} lang={lang} collected={collected} big />
            </div>

            <section className="lc-card">
              <h2 className="lc-h2">{t('finale.finalPlace')}</h2>
              <p className="lc-text"><RichText text={content.finale.finalPlace} /></p>
            </section>
            <Link to="/game/leaderboard" className="lc-button lc-button--ghost">🏆 {t('hub.leaderboard')}</Link>
          </>
        )}
      </div>

      {celebrating && (
        <Celebration
          title={t('finale.laugh')}
          sentence={lang === 'hr' ? content.finale.sentence : content.finale.translation}
          buttonLabel={t('finale.claimPrize')}
          onClose={() => {
            setCelebrating(false)
            // on to the grand prize code
            requestAnimationFrame(() => prizeRef.current?.scrollIntoView({ block: 'center' }))
          }}
        />
      )}
    </div>
  )
}
