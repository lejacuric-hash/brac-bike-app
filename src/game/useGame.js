import { useEffect, useSyncExternalStore } from 'react'
import { getState, initGameStore, subscribe } from './store'
import { getContent, getT } from './i18n'

export function useGameState() {
  useEffect(() => {
    initGameStore()
  }, [])
  return useSyncExternalStore(subscribe, getState)
}

// State + the language-bound helpers every game screen needs
export function useGame() {
  const state = useGameState()
  const lang = state.player?.language || state.lang
  return {
    state,
    lang,
    t: getT(lang),
    content: getContent(lang),
    collected: state.player?.collected_letters || [],
  }
}

// A stop is found once the team has been there (location check), finished
// it, or asked for the exact spot on the map.
export const isStopFound = (result) => !!(result?._unlocked || result?.completed_at || result?.hint_used)

export function stopStatus(result) {
  if (result?.completed_at) return 'done'
  if (result?.answered_correctly) return 'lettered'
  if (result) return 'started'
  return 'todo'
}
