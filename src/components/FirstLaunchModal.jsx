import { useEffect, useState } from 'react'
import './FirstLaunchModal.css'

const STORAGE_KEY = 'brac_onboarding_last_seen'

const todayString = () => new Date().toISOString().split('T')[0]

const RULES = [
  {
    icon: '🔥',
    title: 'No open fires',
    text: 'Brač is high fire-risk in summer — no grilling, no campfires outside marked areas.',
  },
  {
    icon: '🎒',
    title: 'Leave no trace',
    text: 'Pack out everything you bring — trash, food scraps, everything.',
  },
  {
    icon: '🐐',
    title: 'Respect the land',
    text: 'Stay on marked trails, close gates behind you, and give way to livestock.',
  },
  {
    icon: '💧',
    title: 'Water is scarce',
    text: "Carry more than you think you'll need — many routes have no fountains or shops.",
  },
]

export default function FirstLaunchModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== todayString()) {
      setOpen(true)
    }
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, todayString())
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="first-launch-overlay">
      <div className="first-launch-card">
        <h2 className="first-launch-title">Riding Brač Responsibly 🏝️</h2>
        <p className="first-launch-subtitle">A few things to know before you hit the trails</p>

        <ul className="first-launch-list">
          {RULES.map((rule) => (
            <li key={rule.title} className="first-launch-item">
              <span className="first-launch-icon">{rule.icon}</span>
              <span className="first-launch-item-text">
                <strong>{rule.title}:</strong> {rule.text}
              </span>
            </li>
          ))}
        </ul>

        <button type="button" className="first-launch-button" onClick={handleDismiss}>
          Got it, let&apos;s ride →
        </button>
      </div>
    </div>
  )
}
