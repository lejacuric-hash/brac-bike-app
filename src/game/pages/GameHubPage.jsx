import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { stopsOfGame } from '../structure'
import { getT } from '../i18n'
import { refreshClaims, setLang, startPlayer } from '../store'
import { useGame } from '../useGame'
import SentenceBar from '../components/SentenceBar'
import Loda from '../components/Loda'
import Glyph from '../components/Glyph'
import PrizeCard from '../components/PrizeCard'
import LodaKey from '../components/LodaKey'
import RichText from '../components/RichText'
import { LanguageToggle, SyncBanner } from '../components/Bits'
import '../fonts'
import '../Game.css'

const ADMIN_TAPS = 7
// Set by DeepLinkHandler when a scanned QR link can't open a stop
const NOTICES = ['deepLinkOffline', 'deepLinkUnknown', 'deepLinkNoPlayer']

export default function GameHubPage() {
  const { state, lang, t, content, collected } = useGame()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const notice = NOTICES.includes(searchParams.get('notice')) ? searchParams.get('notice') : null

  useEffect(() => {
    refreshClaims()
  }, [])

  // Hidden admin entry: tap the title 7 times in a row
  const taps = useRef({ count: 0, last: 0 })
  const handleTitleTap = () => {
    const now = Date.now()
    taps.current.count = now - taps.current.last < 800 ? taps.current.count + 1 : 1
    taps.current.last = now
    if (taps.current.count >= ADMIN_TAPS) {
      taps.current.count = 0
      navigate('/game/admin')
    }
  }

  if (!state.loaded) return <div className="lc-page" />

  return (
    <div className="lc-page">
      <div className="lc-shell">
        <header className="hub-header">
          <Loda className="hub-loda" />
          <div className="hub-header-text">
            <h1 className="hub-title" onClick={handleTitleTap}>{content.title}</h1>
            <p className="hub-intro">{content.intro}</p>
          </div>
          <LanguageToggle value={lang} onChange={setLang} />
        </header>

        <SyncBanner state={state} t={t} />
        {notice && <div className="game-banner game-banner--error">{t(`stop.${notice}`)}</div>}

        <SentenceBar collected={collected} t={t} words={content.words} />

        {!state.player ? (
          <StartForm defaultLang={lang} />
        ) : (
          <>
            <h2 className="lc-h2">{t('hub.games')}</h2>
            <div className="hub-games">
              {content.games.map((game) => {
                const stops = stopsOfGame(game.id)
                const have = stops.filter((s) => collected.includes(s.letter)).length
                return (
                  <Link key={game.id} to={`/game/${game.id}`} className={`hub-game${have === stops.length ? ' hub-game--done' : ''}`}>
                    <div className="hub-game-kicker">{t('gameLabel', { n: game.id })} · {t('hub.letters', { n: have, total: stops.length })}</div>
                    <div className="hub-game-title">{game.title}</div>
                    <div className="hub-game-subtitle">{game.subtitle}</div>
                    <div className="hub-game-letters">
                      {stops.map((s) => (
                        <span key={s.id} className={`slot slot--big${collected.includes(s.letter) ? ' slot--filled' : ''}`}>
                          <Glyph letter={s.letter} className="slot-glyph" />
                        </span>
                      ))}
                    </div>
                  </Link>
                )
              })}
            </div>

            {collected.length === 20 && (
              <Link to="/game/finale" className="lc-button lc-button--gold">{t('hub.finaleCta')}</Link>
            )}

            <h2 className="lc-h2">{t('hub.prizes')}</h2>
            {[1, 2, 3].map((level) => (
              <PrizeCard key={level} level={level} state={state} t={t} lang={lang} collected={collected} />
            ))}

            {collected.length > 0 && <LodaKey t={t} collected={collected} />}
          </>
        )}

        <details className="lc-details">
          <summary>{t('hub.story')}</summary>
          {content.story.map((p, i) => <p key={i} className="lc-text"><RichText text={p} /></p>)}
        </details>

        <Link to="/game/leaderboard" className="lc-button lc-button--ghost">🏆 {t('hub.leaderboard')}</Link>
      </div>
    </div>
  )
}

function StartForm({ defaultLang }) {
  const [language, setLanguage] = useState(defaultLang)
  const [mode, setMode] = useState('solo')
  const [name, setName] = useState('')
  const [size, setSize] = useState(2)
  const [error, setError] = useState(null)
  const t = getT(language)

  const handleStart = () => {
    const teamName = name.trim()
    if (!teamName) {
      setError(t('start.nameRequired'))
      return
    }
    startPlayer({
      teamName: teamName.slice(0, 40),
      groupSize: mode === 'solo' ? 1 : Math.min(50, Math.max(2, Number(size) || 2)),
      language,
    })
  }

  return (
    <section className="lc-card">
      <h2 className="lc-h2">{t('start.title')}</h2>
      <label className="lc-label">{t('start.language')}</label>
      <LanguageToggle value={language} onChange={(l) => { setLanguage(l); setLang(l) }} />

      <label className="lc-label">{t('start.who')}</label>
      <div className="lc-segmented">
        {['solo', 'group'].map((m) => (
          <button key={m} type="button" className={`lc-segment${mode === m ? ' active' : ''}`} onClick={() => setMode(m)}>
            {t(`start.${m}`)}
          </button>
        ))}
      </div>

      <label className="lc-label" htmlFor="lc-team-name">{mode === 'solo' ? t('start.playerName') : t('start.teamName')}</label>
      <input
        id="lc-team-name"
        className="lc-input"
        value={name}
        maxLength={40}
        onChange={(e) => { setName(e.target.value); setError(null) }}
      />

      {mode === 'group' && (
        <>
          <label className="lc-label" htmlFor="lc-group-size">{t('start.groupSize')}</label>
          <input
            id="lc-group-size"
            className="lc-input"
            type="number"
            min={2}
            max={50}
            value={size}
            onChange={(e) => setSize(e.target.value)}
          />
          <p className="lc-muted">{t('start.oneDevice')}</p>
        </>
      )}
      <p className="lc-muted">{t('start.publicName')}</p>
      {error && <div className="lc-error">{error}</div>}
      <button type="button" className="lc-button lc-button--gold" onClick={handleStart}>{t('start.start')}</button>
    </section>
  )
}

StartForm.propTypes = { defaultLang: PropTypes.string.isRequired }
