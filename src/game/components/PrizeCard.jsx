import PropTypes from 'prop-types'
import { PRIZE_LEVELS } from '../structure'
import { prizeReached } from '../store'
import Loda from './Loda'

// One prize level: what it needs, and its status (locked / waiting for
// photos / code pending / code). `big` shows Loda full size (prize screens).
export default function PrizeCard({ level, state, t, lang, collected, big = false }) {
  const def = PRIZE_LEVELS.find((p) => p.level === level)
  const claim = state.claims[level]
  const reward = state.rewards.find((r) => r.id === claim?.reward_id) || state.rewards.find((r) => r.level === level)
  const rewardName = reward ? (lang === 'hr' ? reward.name_hr : reward.name_en) : null
  const lettersIn = def.letters.every((l) => collected.includes(l))
  const reached = prizeReached(level, state)
  const needsFinale = def.needsFinale && lettersIn && !reached
  const error = state.claimErrors[level]

  let status
  if (claim) status = null
  else if (!lettersIn || needsFinale) status = t('prize.locked')
  else if (!reached) status = t('prize.waitingProof')
  else if (error) status = t('prize.error', { msg: error })
  else status = t('prize.pending')

  return (
    <section className={`prize-card${claim ? ' prize-card--won' : ''}${big ? ' prize-card--big' : ''}`}>
      {big && claim && <Loda className="prize-card-loda" />}
      <div className="prize-card-head">
        <span className="prize-card-title">{t(`prize.title${level}`)}</span>
        {claim && <span className="prize-card-badge">✓</span>}
      </div>
      {rewardName && <div className="prize-card-name">{rewardName}</div>}
      <div className="prize-card-needs">
        {def.words ? t('prize.needs', { words: def.words }) : t('prize.needsAll')}
      </div>
      {claim ? (
        <>
          <div className={`prize-code${claim.redeemed ? ' prize-code--redeemed' : ''}`}>{claim.reward_code}</div>
          <div className="prize-card-note">{claim.redeemed ? t('prize.redeemed') : t('prize.showAtShop')}</div>
        </>
      ) : (
        <div className="prize-card-note">{status}</div>
      )}
    </section>
  )
}

PrizeCard.propTypes = {
  level: PropTypes.oneOf([1, 2, 3]).isRequired,
  state: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
  lang: PropTypes.string.isRequired,
  collected: PropTypes.arrayOf(PropTypes.string).isRequired,
  big: PropTypes.bool,
}
