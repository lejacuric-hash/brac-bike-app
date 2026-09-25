import PropTypes from 'prop-types'
import { LANGUAGES } from '../i18n'

export function SyncBanner({ state, t }) {
  const pendingPhotos = Object.values(state.results).filter((r) => r._photoPending).length
  if (!state.online) return <div className="game-banner">{t('sync.offline')}</div>
  if (state.syncError) return <div className="game-banner game-banner--error">{t('sync.error', { msg: state.syncError })}</div>
  if (pendingPhotos > 0) return <div className="game-banner">{t('sync.pendingPhotos', { count: pendingPhotos })}</div>
  return null
}

SyncBanner.propTypes = {
  state: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
}

export function LanguageToggle({ value, onChange }) {
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      {LANGUAGES.map((l) => (
        <button
          key={l}
          type="button"
          className={`lang-toggle-btn${value === l ? ' active' : ''}`}
          onClick={() => onChange(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

LanguageToggle.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
}
