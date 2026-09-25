import { Link } from 'react-router-dom'
import { useGame } from './useGame'
import SentenceBar from './components/SentenceBar'
import './fonts'
import './Game.css'

// "Lodina abeceda / Loda's Alphabet" card under "Book a Bike" on the Home page:
// a mini sentence line and the letter count.
export default function HomeGameCard() {
  const { t, content, collected } = useGame()

  return (
    <Link to="/game" className="home-game-card">
      <div className="home-game-card-head">
        <span className="home-game-card-title">{t('home.title')}</span>
        <span className="home-game-card-count">{t('sentence.count', { n: collected.length })}</span>
      </div>
      <SentenceBar collected={collected} t={t} words={content.words} compact />
    </Link>
  )
}
