import { Link, Navigate, useParams } from 'react-router-dom'
import { GAME_IDS, stopsOfGame } from '../structure'
import { stopStatus, useGame } from '../useGame'
import SentenceBar from '../components/SentenceBar'
import Parchment from '../components/Parchment'
import Glyph from '../components/Glyph'
import RichText from '../components/RichText'
import { SyncBanner } from '../components/Bits'
import '../fonts'
import '../Game.css'

// East trip: optional places with no letters, shown on the Game 5 page
// (the content suggests combining it with Game 5).
const EAST_TRIP_GAME = 5

export default function GamePage() {
  const { gameId } = useParams()
  const id = Number(gameId)
  const { state, t, content, collected } = useGame()

  if (!GAME_IDS.includes(id)) return <Navigate to="/game" replace />
  if (!state.loaded) return <div className="lc-page" />
  if (!state.player) return <Navigate to="/game" replace />

  const game = content.games.find((g) => g.id === id)
  const stops = stopsOfGame(id)
  const allCollected = stops.every((s) => collected.includes(s.letter))
  const bonus = stops.flatMap((s) => content.stops[s.id].bonusStories.map((text) => ({ text, stop: content.stops[s.id].name })))

  return (
    <div className="lc-page">
      <SentenceBar collected={collected} t={t} words={content.words} sticky />
      <div className="lc-shell">
        <Link to="/game" className="lc-back">{t('back')}</Link>
        <div className="lc-kicker">{t('gameLabel', { n: id })}</div>
        <h1 className="lc-title">{game.title}</h1>
        <p className="lc-subtitle">{game.subtitle}</p>
        <SyncBanner state={state} t={t} />

        <dl className="game-meta">
          {game.meta.map((m) => (
            <div key={m.label} className="game-meta-row">
              <dt>{m.label}</dt>
              <dd><RichText text={m.text} /></dd>
            </div>
          ))}
        </dl>

        <Parchment title={t('game.letter')} paragraphs={game.lettersIntro} />

        <h2 className="lc-h2">{t('game.stops')}</h2>
        <p className="lc-muted">{t('game.anyOrder')}</p>
        <div className="stop-list">
          {stops.map((s) => {
            const status = stopStatus(state.results[s.id])
            return (
              <Link key={s.id} to={`/game/stop/${s.id}`} className={`stop-row stop-row--${status}`}>
                <span className={`slot slot--big${collected.includes(s.letter) ? ' slot--filled' : ''}`}>
                  <Glyph letter={s.letter} className="slot-glyph" />
                </span>
                <span className="stop-row-name">{content.stops[s.id].name}</span>
                <span className="stop-row-status" aria-hidden="true">{status === 'done' ? '✓' : status === 'lettered' ? '📷' : '›'}</span>
              </Link>
            )
          })}
        </div>

        {allCollected && (
          <Parchment title={t('game.endMessage')} paragraphs={[game.endMessage]} signature={t('signature')} className="parchment--message" />
        )}

        {bonus.length > 0 && (
          <>
            <h2 className="lc-h2">{t('game.bonus')} <span className="lc-tag">{t('game.noLetter')}</span></h2>
            {bonus.map((b, i) => (
              <section key={i} className="bonus-card">
                <div className="bonus-card-place">{b.stop}</div>
                <p className="lc-text"><RichText text={b.text} /></p>
              </section>
            ))}
          </>
        )}

        {id === EAST_TRIP_GAME && content.eastTrip && (
          <details className="lc-details bonus-card">
            <summary>{content.eastTrip.title}</summary>
            <p className="lc-text">{content.eastTrip.intro}</p>
            {content.eastTrip.places.map((p, i) => <p key={i} className="lc-text"><RichText text={p} /></p>)}
          </details>
        )}
      </div>
    </div>
  )
}
