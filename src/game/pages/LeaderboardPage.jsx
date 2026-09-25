import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { formatDate, formatDuration } from '../i18n'
import { useGame } from '../useGame'
import '../fonts'
import '../Game.css'

// Teams that put the whole sentence together, fastest first
// (started_at → finale_completed_at). Public; no photos.
export default function LeaderboardPage() {
  const { lang, t } = useGame()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!navigator.onLine) {
      setError(t('lb.offline'))
      return undefined
    }
    supabase.rpc('game_leaderboard', { p_limit: 100 }).then(({ data, error: rpcError }) => {
      if (cancelled) return
      if (rpcError) setError(rpcError.message)
      else setRows(data || [])
    })
    return () => {
      cancelled = true
    }
  }, [t])

  return (
    <div className="lc-page">
      <div className="lc-shell">
        <Link to="/game" className="lc-back">{t('back')}</Link>
        <h1 className="lc-title">🏆 {t('lb.title')}</h1>
        <p className="lc-muted">{t('lb.subtitle')}</p>

        {error ? (
          <p className="lc-error">{error}</p>
        ) : rows == null ? (
          <p className="lc-muted">{t('lb.loading')}</p>
        ) : rows.length === 0 ? (
          <p className="lc-muted">{t('lb.empty')}</p>
        ) : (
          <table className="lc-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('lb.team')}</th>
                <th>{t('lb.players')}</th>
                <th>{t('lb.time')}</th>
                <th>{t('lb.date')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td className="lc-table-team">
                    {r.team_name}
                    {r.hint_used && <span title={t('lb.hintLegend')}> 💡</span>}
                  </td>
                  <td>{r.group_size}</td>
                  <td>{formatDuration(r.duration_seconds)}</td>
                  <td>{formatDate(r.finale_completed_at, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rows?.some((r) => r.hint_used) && <p className="lc-muted">{t('lb.hintLegend')}</p>}
      </div>
    </div>
  )
}
