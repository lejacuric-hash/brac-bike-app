import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useBackgroundGps } from '../../hooks/useBackgroundGps'
import { haversineDistanceKm } from '../../utils/geo'
import {
  baseLetter,
  getStop,
  isUnitUnlocked,
  PRIZE_LEVELS,
  previousStop,
  STOPS,
  stopsOfGame,
  UNITS,
} from '../structure'
import { formatDistance } from '../i18n'
import {
  collectLetter,
  getLocalPhoto,
  getState,
  markUnlocked,
  prizeReached,
  recordQrScan,
  savePhoto,
  updateResult,
} from '../store'
import { capturePhoto, QrUnavailableError, scanQrCode } from '../device'
import { useGame } from '../useGame'
import SentenceBar from '../components/SentenceBar'
import Parchment from '../components/Parchment'
import Loda from '../components/Loda'
import RichText from '../components/RichText'
import PrizeCard from '../components/PrizeCard'
import WordToast from '../components/WordToast'
import { SyncBanner } from '../components/Bits'
import { flyLetter, popSlot } from '../components/LetterFlight'
import '../fonts'
import '../Game.css'

const HINT_AFTER_MISSES = 3
const BUBBLE_MS = 2600
const LIFT_MS = 450 // let the correct button lift before the letter leaves it

export default function StopPage() {
  const { stopId } = useParams()
  const game = useGame()
  const stop = getStop(stopId)

  if (!stop) return <Navigate to="/game" replace />
  if (!game.state.loaded) return <div className="lc-page" />
  if (!game.state.player) return <Navigate to="/game" replace />
  return <StopScreen key={stopId} stop={stop} {...game} />
}

// Stable per player: the answer order is shuffled once and stays put
function seededOrder(seed, n) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const order = [...Array(n).keys()]
  for (let i = n - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
    const j = h % (i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

function nextStopAfter(stop, collected) {
  const loop = stopsOfGame(stop.game)
  const i = loop.findIndex((s) => s.id === stop.id)
  const inGame = [...loop.slice(i + 1), ...loop.slice(0, i)].find((s) => !collected.includes(s.letter))
  return inGame || STOPS.find((s) => !collected.includes(s.letter)) || null
}

function StopScreen({ stop, state, lang, t, content, collected }) {
  const c = content.stops[stop.id]
  const result = state.results[stop.id]
  const location = state.stops[stop.id]
  const answered = !!result?.answered_correctly
  const completed = !!result?.completed_at
  const unlocked = !!(result?._unlocked || answered || completed)
  const qrRequired = !!location?.qr_required
  const qrDone = !!(result?.qr_scanned_at || result?._qrPending)
  const photoDone = !!(result?.photo_url || result?._photoPending)
  const proofDone = photoDone || (qrRequired && qrDone)
  const [searchParams, setSearchParams] = useSearchParams()
  const linkCode = searchParams.get('qr')
  const sentenceRef = useRef(null)

  // --- Location: needed to unlock, and again to scan a QR board
  const [position, setPosition] = useState(null)
  const handlePosition = useCallback((p) => setPosition(p), [])
  const { permissionDenied } = useBackgroundGps({
    active: !completed && (!unlocked || (qrRequired && !qrDone)),
    onPosition: handlePosition,
    notificationTitle: content.title,
    notificationText: t('stop.waitingGps'),
  })
  const distance = position && location
    ? haversineDistanceKm([position.lat, position.lng], [location.lat, location.lng]) * 1000
    : null
  const radius = location?.radius_m ?? 100
  const inside = distance != null && distance <= radius

  useEffect(() => {
    if (!unlocked && inside) markUnlocked(stop.id)
  }, [unlocked, inside, stop.id])

  // --- Stop is complete once it has its letter and proof of presence
  useEffect(() => {
    if (answered && proofDone && !completed) updateResult(stop.id, { completed_at: new Date().toISOString() })
  }, [answered, proofDone, completed, stop.id])

  // --- Loda's reactions
  const [reaction, setReaction] = useState(null) // { text, mood, anim, key }
  const react = useCallback((text, mood, anim) => {
    setReaction({ text, mood, anim, key: Date.now() })
  }, [])
  useEffect(() => {
    if (!reaction?.text) return undefined
    const timer = setTimeout(() => setReaction((r) => (r === reaction ? { ...r, text: null, mood: 'default', anim: null } : r)), BUBBLE_MS)
    return () => clearTimeout(timer)
  }, [reaction])

  // --- What this visit unlocked: words, prizes, end of the game
  const [justCollected, setJustCollected] = useState(false)
  const [toastQueue, setToastQueue] = useState([])
  const prizesAtMount = useRef(PRIZE_LEVELS.map((p) => p.level).filter((level) => prizeReached(level, state)))
  const newPrizes = PRIZE_LEVELS.map((p) => p.level).filter(
    (level) => prizeReached(level, state) && !prizesAtMount.current.includes(level)
  )
  const gameLetters = stopsOfGame(stop.game).map((s) => s.letter)
  const gameComplete = gameLetters.every((l) => collected.includes(l))
  const gameContent = content.games.find((g) => g.id === stop.game)
  const next = nextStopAfter(stop, collected)
  const dropToast = useCallback(() => setToastQueue((q) => q.slice(1)), [])

  const handleCorrect = async ({ fromEl, attempts }) => {
    const before = getState().player.collected_letters
    const slotEls = [...(sentenceRef.current?.querySelectorAll(`.slot[data-letter="${stop.letter}"]`) || [])]
    await flyLetter({ fromEl, letter: stop.letter, slotEls, onLand: popSlot })
    collectLetter(stop.id, stop.letter, attempts)
    const after = getState().player.collected_letters
    const words = UNITS.filter((u) => !isUnitUnlocked(u, before) && isUnitUnlocked(u, after))
      .map((u) => ({ word: u.word, en: content.words.find((w) => w.word === u.word)?.en ?? '' }))
    setToastQueue((q) => [...q, ...words])
    setJustCollected(true)
    react(t('stop.bravo'), 'default', 'hop')
  }

  // --- QR boards (in-app scan, or ?qr=<code> from a https://<domain>/g/<code> link)
  const [qrMessage, setQrMessage] = useState(null)
  useEffect(() => {
    if (!linkCode) return
    if (!qrRequired || qrDone) {
      setSearchParams({}, { replace: true })
      return
    }
    if (!inside) return // wait until the team is at the stop
    recordQrScan(stop.id, linkCode, position)
    setSearchParams({}, { replace: true })
  }, [linkCode, qrRequired, qrDone, inside, position, stop.id, setSearchParams])

  const handleScan = async () => {
    setQrMessage(null)
    try {
      const code = await scanQrCode()
      if (!code) return
      if (!inside) {
        setQrMessage(t('stop.qrTooFar'))
        return
      }
      recordQrScan(stop.id, code, position)
    } catch (err) {
      setQrMessage(err instanceof QrUnavailableError ? t('stop.qrNotAvailable') : err.message)
    }
  }

  const prev = previousStop(stop.id)
  const clueTo = prev && !content.stops[prev.id].clueIsReturn ? content.stops[prev.id].clue : null

  return (
    <div className="lc-page">
      <SentenceBar ref={sentenceRef} collected={collected} t={t} words={content.words} sticky />
      <div className="lc-shell">
        <Link to={`/game/${stop.game}`} className="lc-back">{t('back')}</Link>
        <SyncBanner state={state} t={t} />

        {/* b) Loda's parchment, Loda peeking over the corner */}
        <div className="stage">
          <Loda
            mood={reaction?.mood || 'default'}
            anim={reaction ? reaction.anim : 'peek'}
            animKey={reaction?.key || 0}
            className="stage-loda"
          />
          <div className={`bubble${reaction?.text ? ' bubble--show' : ''}`} aria-live="polite">{reaction?.text}</div>
          <Parchment title={c.name} paragraphs={[c.story]} signature={t('signature')} className="parchment--stop" />
        </div>

        {/* c) location check, clue and navigation */}
        {!answered && (
          <section className={`lc-card location${unlocked ? ' location--unlocked' : ''}`}>
            {clueTo && (
              <div className="clue">
                <div className="clue-label">{t('stop.clue')}</div>
                <em>{clueTo}</em>
              </div>
            )}
            {unlocked ? (
              <p className="lc-text">✓ {t('stop.unlocked')}</p>
            ) : permissionDenied ? (
              <p className="lc-error">{t('stop.gpsDenied')}</p>
            ) : distance == null ? (
              <p className="lc-muted">{t('stop.waitingGps')}</p>
            ) : (
              <>
                <div className="location-distance">{formatDistance(distance)}</div>
                {position?.accuracy != null && <div className="lc-muted">{t('stop.accuracy', { a: Math.round(position.accuracy) })}</div>}
                <p className="lc-text">{t('stop.getCloser', { r: radius })}</p>
              </>
            )}
            {!unlocked && (
              <Link to={`/game/stop/${stop.id}/map`} className="lc-button">🧭 {t('stop.navigate')}</Link>
            )}
            {state.isAdmin && !location?.verified && <p className="admin-note">{t('stop.unverified')}</p>}
            {state.isAdmin && !unlocked && (
              <button type="button" className="lc-button lc-button--ghost" onClick={() => markUnlocked(stop.id)}>
                {t('stop.adminSkip')}
              </button>
            )}
          </section>
        )}

        {/* d) the question */}
        {unlocked && (
          <Question
            key={stop.id}
            stop={stop}
            c={c}
            t={t}
            seed={`${state.player.id}:${stop.id}`}
            answered={answered}
            misses={result?.attempts && !answered ? result.attempts : 0}
            onWrong={(attempts) => {
              updateResult(stop.id, { attempts })
              react(t('stop.wrong'), 'sad', 'sad')
            }}
            onCorrect={handleCorrect}
          />
        )}

        {/* e) facts, bonus stories and the proof of presence */}
        {answered && (
          <>
            <section className="lc-card">
              <h2 className="lc-h2">{t('stop.facts')}</h2>
              <p className="lc-text"><RichText text={c.facts} /></p>
            </section>

            {qrRequired && (
              <section className="lc-card">
                <p className="lc-text">{t('stop.qrRequired')}</p>
                {result?.qr_scanned_at ? (
                  <p className="lc-text">✓ {t('stop.qrOk')}</p>
                ) : result?._qrPending ? (
                  <p className="lc-muted">{t('stop.qrChecking')}</p>
                ) : (
                  <button type="button" className="lc-button" onClick={handleScan}>▦ {t('stop.scanQr')}</button>
                )}
                {result?._qrError && <p className="lc-error">{t('stop.qrRejected', { msg: result._qrError })}</p>}
                {qrMessage && <p className="lc-error">{qrMessage}</p>}
              </section>
            )}

            <PhotoStep t={t} stopId={stop.id} task={c.photoTask} result={result} optional={qrRequired && qrDone} />

            {c.bonusStories.map((text, i) => (
              <section key={i} className="bonus-card">
                <div className="bonus-card-place">{t('stop.bonus')}</div>
                <p className="lc-text"><RichText text={text} /></p>
              </section>
            ))}
          </>
        )}

        {/* f) messages and the way on */}
        {answered && (
          <>
            {newPrizes.map((level) => (
              <PrizeCard key={level} level={level} state={state} t={t} lang={lang} collected={collected} big />
            ))}
            {justCollected && gameComplete && (
              <Parchment title={t('game.endMessage')} paragraphs={[gameContent.endMessage]} signature={t('signature')} className="parchment--message" />
            )}
            {!proofDone && <p className="lc-muted">{t('stop.needProof')}</p>}
            {c.clue && (
              <div className="clue">
                <div className="clue-label">{c.clueIsReturn ? t('stop.returnClue') : t('stop.clue')}</div>
                <em>{c.clue}</em>
              </div>
            )}
            {next ? (
              <Link to={`/game/stop/${next.id}`} className="lc-button lc-button--gold">{t('stop.nextStop')} →</Link>
            ) : (
              <Link to="/game/finale" className="lc-button lc-button--gold">{t('stop.toFinale')} →</Link>
            )}
            <Link to={`/game/${stop.game}`} className="lc-button lc-button--ghost">{t('stop.backToGame')}</Link>
          </>
        )}
      </div>

      <WordToast queue={toastQueue} onDone={dropToast} title={t('stop.newWord')} />
    </div>
  )
}

StopScreen.propTypes = {
  stop: PropTypes.object.isRequired,
  state: PropTypes.object.isRequired,
  lang: PropTypes.string.isRequired,
  t: PropTypes.func.isRequired,
  content: PropTypes.object.isRequired,
  collected: PropTypes.arrayOf(PropTypes.string).isRequired,
}

// Three answer buttons, shuffled once per player. Each answer is rendered
// one <span> per character so the letter can fly out of the right one.
function Question({ stop, c, t, seed, answered, misses, onWrong, onCorrect }) {
  const order = useMemo(() => seededOrder(seed, c.options.length), [seed, c.options.length])
  const [wrong, setWrong] = useState({}) // option index → shake counter
  const [missCount, setMissCount] = useState(misses)
  const [solving, setSolving] = useState(false)
  const [srcChar, setSrcChar] = useState(-1)
  const buttonRefs = useRef({})
  const solved = answered || solving

  const choose = (index) => {
    if (solved) return
    if (index !== c.correctIndex) {
      const nextMisses = missCount + 1
      setMissCount(nextMisses)
      setWrong((w) => ({ ...w, [index]: (w[index] || 0) + 1 }))
      onWrong(nextMisses)
      return
    }
    setSolving(true)
    const answer = c.options[index]
    const target = baseLetter(stop.letter)
    const charIndex = [...answer].findIndex((ch) => baseLetter(ch) === target)
    setSrcChar(charIndex)
    setTimeout(() => {
      const button = buttonRefs.current[index]
      const fromEl = charIndex >= 0 ? button?.querySelector(`[data-ch="${charIndex}"]`) : button
      onCorrect({ fromEl: fromEl || button, attempts: missCount + 1 })
    }, LIFT_MS)
  }

  return (
    <section className="quiz">
      <h2 className="lc-h2">{t('stop.question')}</h2>
      <p className="quiz-q"><RichText text={c.question} /></p>
      <div className={`answers${solved ? ' answers--solved' : ''}`}>
        {order.map((index) => {
          const isRight = solved && index === c.correctIndex
          return (
            <button
              key={`${index}-${wrong[index] || 0}`}
              ref={(el) => { buttonRefs.current[index] = el }}
              type="button"
              className={`answer${wrong[index] ? ' answer--wrong' : ''}${isRight ? ' answer--right' : ''}`}
              onClick={() => choose(index)}
              disabled={solved}
            >
              {[...c.options[index]].map((ch, i) => (
                <span key={i} data-ch={i} className={`answer-ch${isRight && i === srcChar ? ' answer-ch--src' : ''}`}>{ch}</span>
              ))}
            </button>
          )
        })}
      </div>
      {!solved && missCount >= HINT_AFTER_MISSES && <p className="quiz-hint">💡 {t('stop.hint')}</p>}
    </section>
  )
}

Question.propTypes = {
  stop: PropTypes.object.isRequired,
  c: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
  seed: PropTypes.string.isRequired,
  answered: PropTypes.bool.isRequired,
  misses: PropTypes.number.isRequired,
  onWrong: PropTypes.func.isRequired,
  onCorrect: PropTypes.func.isRequired,
}

// Camera → preview → "Ponovi / Retake" or "Potvrdi / Use this photo". Only a
// confirmed photo is saved (compressed, in IndexedDB) and queued for upload.
function PhotoStep({ t, stopId, task, result, optional }) {
  const [draft, setDraft] = useState(null) // { blob, url } not yet confirmed
  const [savedUrl, setSavedUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const draftRef = useRef(null)
  const photoRev = result?._photoRev

  useEffect(() => {
    let url = null
    let cancelled = false
    getLocalPhoto(stopId).then((blob) => {
      if (cancelled || !blob) return
      url = URL.createObjectURL(blob)
      setSavedUrl(url)
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [stopId, photoRev])

  useEffect(() => () => {
    if (draftRef.current) URL.revokeObjectURL(draftRef.current.url)
  }, [])

  const setDraftPhoto = (next) => {
    if (draftRef.current) URL.revokeObjectURL(draftRef.current.url)
    draftRef.current = next
    setDraft(next)
  }

  const take = async () => {
    setError(null)
    try {
      const blob = await capturePhoto()
      if (blob) setDraftPhoto({ blob, url: URL.createObjectURL(blob) })
    } catch {
      setError(t('stop.photoError'))
    }
  }

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await savePhoto(stopId, draft.blob)
      setDraftPhoto(null)
    } catch {
      setError(t('stop.photoError'))
    } finally {
      setBusy(false)
    }
  }

  const hasPhoto = !!(result?.photo_url || result?._photoPending)

  return (
    <section className="lc-card">
      <h2 className="lc-h2">{t('stop.photoTask')}</h2>
      <p className="lc-text"><RichText text={task} /></p>
      {optional && !hasPhoto && <p className="lc-muted">{t('stop.photoOptional')}</p>}
      {draft ? (
        <>
          <img src={draft.url} alt="" className="photo-preview" />
          <div className="lc-button-row">
            <button type="button" className="lc-button lc-button--ghost" onClick={take} disabled={busy}>{t('stop.retakePhoto')}</button>
            <button type="button" className="lc-button lc-button--gold" onClick={confirm} disabled={busy}>✓ {t('stop.usePhoto')}</button>
          </div>
        </>
      ) : (
        <>
          {hasPhoto && savedUrl && <img src={savedUrl} alt="" className="photo-preview" />}
          {hasPhoto && (
            <p className="lc-muted">{result?._photoPending ? t('stop.photoSavedOffline') : t('stop.photoUploaded')}</p>
          )}
          <button type="button" className={`lc-button${hasPhoto ? ' lc-button--ghost' : ' lc-button--gold lc-button--big'}`} onClick={take}>
            📷 {hasPhoto ? t('stop.retakePhoto') : t('stop.takePhoto')}
          </button>
        </>
      )}
      {error && <div className="lc-error">{error}</div>}
    </section>
  )
}

PhotoStep.propTypes = {
  t: PropTypes.func.isRequired,
  stopId: PropTypes.string.isRequired,
  task: PropTypes.string.isRequired,
  result: PropTypes.object,
  optional: PropTypes.bool,
}
