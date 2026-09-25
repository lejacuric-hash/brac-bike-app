import { useEffect } from 'react'
import PropTypes from 'prop-types'
import Loda from './Loda'

// Small toast for a newly unlocked word: Loda, the word and its English
// translation. Shows one word at a time; the parent passes a queue.
export default function WordToast({ queue, onDone, title }) {
  const current = queue[0]
  useEffect(() => {
    if (!current) return undefined
    const timer = setTimeout(onDone, 3200)
    return () => clearTimeout(timer)
  }, [current, onDone])

  if (!current) return null
  return (
    <div className="word-toast" role="status" key={current.word} onClick={onDone}>
      <Loda className="word-toast-loda" />
      <div>
        <div className="word-toast-title">{title}</div>
        <div className="word-toast-word">{current.word}</div>
        <div className="word-toast-en">{current.en}</div>
      </div>
    </div>
  )
}

WordToast.propTypes = {
  queue: PropTypes.arrayOf(PropTypes.shape({ word: PropTypes.string, en: PropTypes.string })).isRequired,
  onDone: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
}
