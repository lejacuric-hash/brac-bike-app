import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { useBackgroundGps } from '../../hooks/useBackgroundGps'
import { haversineDistanceKm } from '../../utils/geo'
import { STOPS } from '../structure'
import { gameLinkUrl } from '../config'
import { formatDate, formatDistance, getT } from '../i18n'
import { adminSignIn, adminSignOut, adminUpdateStop, refreshRemoteData } from '../store'
import { useGameState } from '../useGame'
import '../fonts'
import '../Game.css'

const MAX_ACCURACY_M = 20

// Hidden screen (tap the chronicle title on /game seven times, or open
// /game/admin). Requires a Supabase email/password user listed in app_admins.
export default function AdminPage() {
  const state = useGameState()
  const t = getT(state.lang)
  const [tab, setTab] = useState('stops')

  const signedIn = state.userId && !state.isAnonymous

  return (
    <div className="lc-page">
      <div className="lc-shell">
        <Link to="/game" className="lc-back">{t('back')}</Link>
        <h1 className="lc-title">{t('admin.title')}</h1>

        {!signedIn ? (
          <SignInForm t={t} />
        ) : !state.isAdmin ? (
          <section className="lc-card">
            <p className="lc-error">{t('admin.notAdmin')}</p>
            <button type="button" className="lc-button lc-button--ghost" onClick={adminSignOut}>{t('admin.signOut')}</button>
          </section>
        ) : (
          <>
            <div className="lc-segmented lc-segmented--tabs">
              {[['stops', 'admin.tabStops'], ['qr', 'admin.tabQr'], ['rewards', 'admin.tabRewards']].map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={`lc-segment${tab === k ? ' active' : ''}`}
                  onClick={() => setTab(k)}
                >
                  {t(label)}
                </button>
              ))}
            </div>
            {tab === 'stops' && <StopsAdmin t={t} stops={state.stops} />}
            {tab === 'qr' && <QrAdmin t={t} stops={state.stops} />}
            {tab === 'rewards' && <RewardsAdmin t={t} rewards={state.rewards} lang={state.lang} />}
            <button type="button" className="lc-button lc-button--ghost" onClick={adminSignOut}>{t('admin.signOut')}</button>
          </>
        )}
      </div>
    </div>
  )
}

function SignInForm({ t }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await adminSignIn(email.trim(), password)
    } catch (err) {
      setError(t('admin.error', { msg: err.message }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="lc-card" onSubmit={submit}>
      <label className="lc-label" htmlFor="admin-email">{t('admin.email')}</label>
      <input id="admin-email" className="lc-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="lc-label" htmlFor="admin-password">{t('admin.password')}</label>
      <input id="admin-password" className="lc-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <p className="lc-muted">{t('admin.signInNote')}</p>
      {error && <div className="lc-error">{error}</div>}
      <button type="submit" className="lc-button" disabled={busy}>{t('admin.signIn')}</button>
    </form>
  )
}

SignInForm.propTypes = { t: PropTypes.func.isRequired }

function StopsAdmin({ t, stops }) {
  const [position, setPosition] = useState(null)
  const handlePosition = useCallback((p) => setPosition(p), [])
  const { permissionDenied } = useBackgroundGps({
    active: true,
    onPosition: handlePosition,
    notificationTitle: 'Brač by Bike admin',
    notificationText: t('admin.myPosition'),
  })

  useEffect(() => {
    refreshRemoteData()
  }, [])

  const accuracyOk = position != null && position.accuracy < MAX_ACCURACY_M
  const list = STOPS.map((s) => stops[s.id]).filter(Boolean)

  return (
    <>
      <section className={`lc-card admin-gps${accuracyOk ? ' admin-gps--ok' : ''}`}>
        <h2 className="lc-h2">{t('admin.myPosition')}</h2>
        {permissionDenied ? (
          <p className="lc-error">{t('stop.gpsDenied')}</p>
        ) : position ? (
          <>
            <div className="admin-coords">{position.lat.toFixed(6)}, {position.lng.toFixed(6)}</div>
            <div className="lc-text">±{Math.round(position.accuracy)} m</div>
            <p className="lc-muted">{accuracyOk ? t('admin.accuracyGood') : t('admin.accuracyBad')}</p>
          </>
        ) : (
          <p className="lc-muted">{t('stop.waitingGps')}</p>
        )}
      </section>

      {list.map((stop) => (
        <StopAdminRow
          key={stop.id}
          t={t}
          stop={stop}
          position={position}
          accuracyOk={accuracyOk}
        />
      ))}
    </>
  )
}

StopsAdmin.propTypes = {
  t: PropTypes.func.isRequired,
  stops: PropTypes.object.isRequired,
}

function StopAdminRow({ t, stop, position, accuracyOk }) {
  const [radius, setRadius] = useState(String(stop.radius_m))
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setRadius(String(stop.radius_m))
  }, [stop.radius_m])

  const distance = position
    ? haversineDistanceKm([position.lat, position.lng], [stop.lat, stop.lng]) * 1000
    : null

  const run = async (patch) => {
    setBusy(true)
    setMessage(null)
    try {
      await adminUpdateStop(stop.id, patch)
      setMessage(t('admin.saved'))
    } catch (err) {
      setMessage(t('admin.error', { msg: err.message }))
    } finally {
      setBusy(false)
    }
  }

  const saveLocation = () => {
    if (!accuracyOk) return
    if (!window.confirm(t('admin.confirmSave', { name: stop.name }))) return
    run({ lat: position.lat, lng: position.lng, verified: true, recorded_accuracy_m: position.accuracy })
  }

  const saveTrailhead = () => {
    if (!accuracyOk) return
    if (!window.confirm(t('admin.confirmTrailhead', { name: stop.name }))) return
    run({ trailhead_lat: position.lat, trailhead_lng: position.lng })
  }

  const saveRadius = () => {
    const value = Math.round(Number(radius))
    if (!Number.isFinite(value) || value < 10 || value > 2000) return
    run({ radius_m: value })
  }

  return (
    <section className="lc-card admin-stop">
      <div className="admin-stop-head">
        <div>
          <div className="lc-card-title">{stop.name}</div>
          <div className="lc-muted">{t('gameLabel', { n: stop.game })} · {stop.letter} · {stop.id}</div>
        </div>
        <span className={`admin-badge${stop.verified ? ' admin-badge--ok' : ''}`}>
          {stop.verified ? t('admin.verified') : t('admin.unverified')}
        </span>
      </div>
      <div className="admin-coords">
        {Number(stop.lat).toFixed(6)}, {Number(stop.lng).toFixed(6)}
        {stop.recorded_accuracy_m != null && ` (±${Math.round(stop.recorded_accuracy_m)} m)`}
      </div>
      {distance != null && <div className="lc-muted">{t('admin.fromHere', { d: formatDistance(distance) })}</div>}

      <div className="lc-inline-form">
        <label className="lc-label" htmlFor={`radius-${stop.id}`}>{t('admin.radius')}</label>
        <input
          id={`radius-${stop.id}`}
          className="lc-input admin-radius"
          type="number"
          min={10}
          max={2000}
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
        />
        <button type="button" className="lc-button lc-button--ghost" onClick={saveRadius} disabled={busy || Number(radius) === stop.radius_m}>
          {t('admin.save')}
        </button>
      </div>

      <label className="admin-toggle">
        <input type="checkbox" checked={!!stop.on_foot} disabled={busy} onChange={(e) => run({ on_foot: e.target.checked })} />
        {t('admin.onFoot')}
      </label>
      <label className="admin-toggle">
        <input type="checkbox" checked={!!stop.qr_required} disabled={busy} onChange={(e) => run({ qr_required: e.target.checked })} />
        {t('admin.qrRequired')}
      </label>

      <button type="button" className="lc-button" onClick={saveLocation} disabled={busy || !accuracyOk}>
        📍 {t('admin.saveHere')}
      </button>

      {stop.on_foot && (
        <>
          <div className="lc-muted">
            {stop.trailhead_lat != null
              ? t('admin.trailhead', { coords: `${Number(stop.trailhead_lat).toFixed(6)}, ${Number(stop.trailhead_lng).toFixed(6)}` })
              : t('admin.noTrailhead')}
          </div>
          <button type="button" className="lc-button lc-button--ghost" onClick={saveTrailhead} disabled={busy || !accuracyOk}>
            🚲 {t('admin.saveTrailhead')}
          </button>
        </>
      )}
      {message && <div className="lc-muted">{message}</div>}
    </section>
  )
}

StopAdminRow.propTypes = {
  t: PropTypes.func.isRequired,
  stop: PropTypes.object.isRequired,
  position: PropTypes.object,
  accuracyOk: PropTypes.bool.isRequired,
}

// QR boards: one or more codes per place; a lost board gets a new code and
// the old one is deactivated. Export lists the active codes' URLs.
function QrAdmin({ t, stops }) {
  const [codes, setCodes] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('game_qr_codes')
      .select('*')
      .order('created_at', { ascending: false })
    if (queryError) setError(t('admin.error', { msg: queryError.message }))
    else setCodes(data || [])
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  const act = async (fn) => {
    setBusy(true)
    setError(null)
    const { error: actError } = await fn()
    setBusy(false)
    if (actError) setError(t('admin.error', { msg: actError.message }))
    else load()
  }

  const createCode = (stopId) => act(() => supabase.rpc('admin_create_qr_code', { p_stop_id: stopId }))
  const deactivate = (code) => {
    if (!window.confirm(t('admin.confirmDeactivate', { code }))) return
    act(() => supabase.from('game_qr_codes').update({ active: false }).eq('code', code))
  }

  const list = STOPS.map((s) => stops[s.id]).filter(Boolean)
  const csvCell = (v) => `"${String(v).replace(/"/g, '""')}"`
  const csv = [
    'stop_id,stop_name,code,url',
    ...codes
      .filter((c) => c.active)
      .map((c) => [c.stop_id, stops[c.stop_id]?.name || '', c.code, gameLinkUrl(c.code)].map(csvCell).join(',')),
  ].join('\n')
  const csvHref = useMemo(() => `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`, [csv])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(csv)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      {error && <p className="lc-error">{error}</p>}
      {list.map((stop) => {
        const stopCodes = codes.filter((c) => c.stop_id === stop.id)
        return (
          <section key={stop.id} className="lc-card">
            <div className="admin-stop-head">
              <div className="lc-card-title">{stop.name}</div>
              {stop.qr_required && <span className="admin-badge admin-badge--ok">QR</span>}
            </div>
            {stopCodes.length === 0 && <p className="lc-muted">{t('admin.noCodes')}</p>}
            {stopCodes.map((c) => (
              <div key={c.code} className={`admin-qr-row${c.active ? '' : ' admin-qr-row--inactive'}`}>
                <span className="admin-recent-code">{c.code}</span>
                {c.active ? (
                  <button type="button" className="lc-button lc-button--ghost" onClick={() => deactivate(c.code)} disabled={busy}>
                    {t('admin.deactivate')}
                  </button>
                ) : (
                  <span className="lc-muted">{t('admin.inactive')}</span>
                )}
              </div>
            ))}
            <button type="button" className="lc-button lc-button--ghost" onClick={() => createCode(stop.id)} disabled={busy}>
              + {t('admin.newCode')}
            </button>
          </section>
        )
      })}

      <section className="lc-card">
        <h2 className="lc-h2">{t('admin.exportTitle')}</h2>
        <textarea className="admin-export" readOnly value={csv} />
        <div className="lc-button-row">
          <button type="button" className="lc-button lc-button--ghost" onClick={copy}>{t('admin.copy')}</button>
          <a className="lc-button lc-button--ghost" href={csvHref} download="brac-game-qr-codes.csv">{t('admin.download')}</a>
        </div>
        {copied && <p className="lc-muted">{t('admin.copied')}</p>}
      </section>
    </>
  )
}

QrAdmin.propTypes = {
  t: PropTypes.func.isRequired,
  stops: PropTypes.object.isRequired,
}

// Prize codes live in game_prize_claims; the team comes from game_players
const CLAIM_FIELDS = 'id, level, reward_id, reward_code, created_at, redeemed, redeemed_at, game_players(team_name, group_size)'

function RewardsAdmin({ t, rewards, lang }) {
  const [code, setCode] = useState('')
  const [found, setFound] = useState(undefined) // undefined = not searched, null = not found
  const [recent, setRecent] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const loadRecent = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('game_prize_claims')
      .select(CLAIM_FIELDS)
      .order('created_at', { ascending: false })
      .limit(30)
    if (queryError) setError(t('admin.error', { msg: queryError.message }))
    else setRecent(data || [])
  }, [t])

  useEffect(() => {
    loadRecent()
  }, [loadRecent])

  const lookup = async (value = code) => {
    const normalized = value.trim().toUpperCase()
    if (!normalized) return
    setCode(normalized)
    setError(null)
    const { data, error: queryError } = await supabase
      .from('game_prize_claims')
      .select(CLAIM_FIELDS)
      .eq('reward_code', normalized)
      .maybeSingle()
    if (queryError) setError(t('admin.error', { msg: queryError.message }))
    else setFound(data)
  }

  const redeem = async () => {
    setBusy(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('admin_redeem_reward', { p_code: found.reward_code })
    setBusy(false)
    if (rpcError) {
      setError(t('admin.error', { msg: rpcError.message }))
      return
    }
    lookup(found.reward_code)
    loadRecent()
  }

  const rewardName = (claim) => {
    const r = rewards.find((x) => x.id === claim.reward_id) || rewards.find((x) => x.level === claim.level)
    return r ? (lang === 'hr' ? r.name_hr : r.name_en) : '—'
  }

  return (
    <>
      <section className="lc-card">
        <label className="lc-label" htmlFor="admin-code">{t('admin.codeLabel')}</label>
        <div className="lc-inline-form">
          <input
            id="admin-code"
            className="lc-input"
            placeholder="BRAC-XXXX"
            value={code}
            autoCapitalize="characters"
            onChange={(e) => { setCode(e.target.value); setFound(undefined) }}
            onKeyDown={(e) => e.key === 'Enter' && lookup()}
          />
          <button type="button" className="lc-button" onClick={() => lookup()}>{t('admin.find')}</button>
        </div>
        {error && <div className="lc-error">{error}</div>}
        {found === null && <p className="lc-error">{t('admin.notFound')}</p>}
        {found && (
          <div className="admin-found">
            <div className="prize-code">{found.reward_code}</div>
            <div className="lc-text">{t(`prize.title${found.level}`)} · {rewardName(found)}</div>
            <div className="lc-muted">
              {found.game_players?.team_name} · {found.game_players?.group_size} · {formatDate(found.created_at, lang)}
            </div>
            {found.redeemed ? (
              <p className="lc-text">✓ {t('prize.redeemed')} {found.redeemed_at && formatDate(found.redeemed_at, lang)}</p>
            ) : (
              <button type="button" className="lc-button lc-button--gold" onClick={redeem} disabled={busy}>{t('admin.markRedeemed')}</button>
            )}
          </div>
        )}
      </section>

      <section className="lc-card">
        <h2 className="lc-h2">{t('admin.recent')}</h2>
        {recent.map((c) => (
          <button key={c.id} type="button" className="admin-recent-row" onClick={() => lookup(c.reward_code)}>
            <span className="admin-recent-code">{c.reward_code}</span>
            <span>{t(`prize.title${c.level}`)} · {c.game_players?.team_name}</span>
            <span>{c.redeemed ? '✓' : ''}</span>
          </button>
        ))}
        <p className="lc-muted">{t('admin.prizesNote')}</p>
      </section>
    </>
  )
}

RewardsAdmin.propTypes = {
  t: PropTypes.func.isRequired,
  rewards: PropTypes.array.isRequired,
  lang: PropTypes.string.isRequired,
}
