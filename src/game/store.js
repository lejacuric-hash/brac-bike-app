import localforage from 'localforage'
import { supabase } from '../supabaseClient'
import { sanitizeFileName } from '../utils/fileName'
import { STOP_SEED } from './stops'
import { detectLanguage } from './i18n'
import { PRIZE_LEVELS } from './structure'

// Offline-first game state. Everything the player does is written to
// IndexedDB (via localforage) first, then pushed to Supabase whenever there
// is signal. Rows carry a few local-only fields (prefixed "_") that never
// reach the server:
//   _dirty/_rev          changed since the last successful sync
//   _remote              the player row exists in Supabase
//   _owner               auth user id the player was synced under
//   _photoPending/_photoRev  a photo is waiting in IndexedDB to upload
//   _unlocked            the stop's location check passed
//   _qrPending/_qrError  a scanned QR code waiting for / rejected by verify_qr_scan()
//   _pendingFinale       finale finish time, waiting for complete_finale()
// Anonymous Supabase sign-in gives each device a user id, which RLS uses.

const db = localforage.createInstance({ name: 'brac-game-loda' })
const STATE_KEY = 'state-v1'
const STOPS_KEY = 'stops-v1'
const REWARDS_KEY = 'rewards-v1'
const PHOTO_BUCKET = 'game-photos'
const photoKey = (stopId) => `photo:${stopId}`

let state = {
  loaded: false,
  lang: detectLanguage(), // UI language before a player exists
  player: null,
  results: {}, // { [stopId]: result }
  claims: {}, // { [level]: claim }
  claimErrors: {}, // { [level]: message }
  stops: Object.fromEntries(STOP_SEED.map((s) => [s.id, s])),
  rewards: [],
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  syncError: null,
  userId: null,
  isAnonymous: true,
  isAdmin: false,
}

const listeners = new Set()
export const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export const getState = () => state

function set(patch) {
  state = { ...state, ...patch }
  listeners.forEach((fn) => fn())
}

function persist() {
  const { lang, player, results, claims } = state
  db.setItem(STATE_KEY, { lang, player, results, claims }).catch(() => {
    // IndexedDB unavailable — state still lives in memory for this run
  })
}

let revCounter = 0
const newRev = () => `${Date.now()}-${revCounter++}`

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

let initPromise = null

export function initGameStore() {
  if (initPromise) return initPromise
  initPromise = (async () => {
    try {
      const [saved, stops, rewards] = await Promise.all([
        db.getItem(STATE_KEY),
        db.getItem(STOPS_KEY),
        db.getItem(REWARDS_KEY),
      ])
      set({
        loaded: true,
        ...(saved
          ? { lang: saved.lang || state.lang, player: saved.player || null, results: saved.results || {}, claims: saved.claims || {} }
          : {}),
        ...(stops ? { stops: { ...state.stops, ...stops } } : {}),
        ...(rewards ? { rewards } : {}),
      })
    } catch {
      set({ loaded: true })
    }

    window.addEventListener('online', () => {
      set({ online: true })
      refreshRemoteData()
      scheduleSync(0)
    })
    window.addEventListener('offline', () => set({ online: false }))

    // Don't call other supabase methods synchronously inside this callback
    // (supabase-js holds an auth lock while it runs) — defer instead.
    supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => updateAuth(session?.user ?? null), 0)
    })
    const { data } = await supabase.auth.getSession()
    await updateAuth(data.session?.user ?? null)

    refreshRemoteData()
    scheduleSync(0)
  })()
  return initPromise
}

async function updateAuth(user) {
  if (!user) {
    set({ userId: null, isAnonymous: true, isAdmin: false })
    return
  }
  const isAnonymous = !!user.is_anonymous
  set({ userId: user.id, isAnonymous })
  if (isAnonymous) {
    set({ isAdmin: false })
    return
  }
  const { data, error } = await supabase.rpc('is_admin')
  set({ isAdmin: !error && data === true })
}

async function ensureUser() {
  const { data } = await supabase.auth.getSession()
  if (data.session?.user) return data.session.user
  const { data: signedIn, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return signedIn.user
}

export async function refreshRemoteData() {
  if (!navigator.onLine) return
  const [{ data: stops, error: stopsError }, { data: rewards, error: rewardsError }] = await Promise.all([
    supabase.from('game_stops').select('*'),
    supabase.from('game_rewards').select('*').eq('active', true),
  ])
  if (!stopsError && stops?.length) {
    const map = Object.fromEntries(stops.map((s) => [s.id, s]))
    set({ stops: map })
    db.setItem(STOPS_KEY, map).catch(() => {})
  }
  if (!rewardsError && rewards) {
    set({ rewards })
    db.setItem(REWARDS_KEY, rewards).catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

// Letters that count for prizes: correct answer and proof of presence
export const provenLetters = (s = state) =>
  Object.values(s.results).filter((r) => r.answered_correctly && r.completed_at).map((r) => r.letter)

export function prizeReached(level, s = state) {
  const def = PRIZE_LEVELS.find((p) => p.level === level)
  const have = provenLetters(s)
  if (!def.letters.every((l) => have.includes(l))) return false
  return !def.needsFinale || !!(s.player?.finale_completed_at || s.player?._pendingFinale)
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

export function setLang(lang) {
  set({ lang })
  if (state.player && state.player.language !== lang) patchPlayer({ language: lang })
  persist()
  scheduleSync()
}

export function startPlayer({ teamName, groupSize, language }) {
  const player = {
    id: uuid(),
    team_name: teamName,
    group_size: groupSize,
    language,
    collected_letters: [],
    started_at: new Date().toISOString(),
    finale_completed_at: null,
    _remote: false,
    _owner: null,
    _dirty: true,
    _rev: newRev(),
  }
  set({ player, lang: language })
  persist()
  scheduleSync()
}

function patchPlayer(patch, { dirty = true } = {}) {
  if (!state.player) return
  set({ player: { ...state.player, ...patch, ...(dirty ? { _dirty: true, _rev: newRev() } : {}) } })
  persist()
}

function patchResult(stopId, patch, { dirty = true } = {}) {
  const stop = state.stops[stopId]
  const current = state.results[stopId] || {
    stop_id: stopId,
    letter: stop?.letter,
    photo_url: null,
    answered_correctly: false,
    attempts: 0,
    hint_used: false,
    qr_scanned_at: null,
    completed_at: null,
  }
  const next = { ...current, ...patch, ...(dirty ? { _dirty: true, _rev: newRev() } : {}) }
  set({ results: { ...state.results, [stopId]: next } })
  persist()
}

export function updateResult(stopId, patch) {
  patchResult(stopId, patch)
  scheduleSync()
}

// A correct answer: the letter is the player's straight away (the location
// check already proved presence); the stop completes once a photo or QR
// scan is in as well.
export function collectLetter(stopId, letter, attempts) {
  patchResult(stopId, { answered_correctly: true, attempts, letter })
  if (!state.player.collected_letters.includes(letter)) {
    patchPlayer({ collected_letters: [...state.player.collected_letters, letter] })
  }
  scheduleSync()
}

// Local-only flag; never synced
export function markUnlocked(stopId) {
  patchResult(stopId, { _unlocked: true }, { dirty: false })
}

// "Show exact spot" on the map — recorded, and shown on the leaderboard
export function recordExactSpotHint(stopId) {
  updateResult(stopId, { hint_used: true })
}

// Checked by the server (active, right stop, inside the radius). Without
// signal it waits here and the team carries on; if the server later rejects
// it, the stop needs proof again.
export function recordQrScan(stopId, code, position) {
  patchResult(stopId, { _qrPending: { code, lat: position.lat, lng: position.lng }, _qrError: null }, { dirty: false })
  scheduleSync(0)
}

export async function savePhoto(stopId, file) {
  const blob = await compressImage(file)
  await db.setItem(photoKey(stopId), blob)
  updateResult(stopId, { _photoPending: true, _photoRev: newRev() })
}

export async function getLocalPhoto(stopId) {
  try {
    return await db.getItem(photoKey(stopId))
  } catch {
    return null
  }
}

export function requestFinale() {
  patchPlayer({ _pendingFinale: new Date().toISOString(), _finaleError: null }, { dirty: false })
  scheduleSync(0)
}

// Deep links: which stop does a code belong to? null if unknown/inactive.
export async function resolveQrCode(code) {
  const { data, error } = await supabase.rpc('resolve_qr_code', { p_code: code })
  if (error) throw error
  return data || null
}

// Downscale to max 1600 px to keep IndexedDB small and uploads quick on a
// weak signal. Falls back to the original file if it can't be decoded.
async function compressImage(file, maxDim = 1600, quality = 0.8) {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    return blob || file
  } catch {
    return file
  }
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

let syncTimer = null
let syncing = false
let syncAgain = false

export function scheduleSync(delay = 1500) {
  clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    sync()
  }, delay)
}

const unclaimedLevels = () =>
  PRIZE_LEVELS.map((p) => p.level).filter((level) => !state.claims[level] && prizeReached(level))

function hasWork() {
  const p = state.player
  if (!p) return false
  if (p._dirty || p._pendingFinale) return true
  if (Object.values(state.results).some((r) => r._dirty || r._photoPending || r._qrPending)) return true
  return unclaimedLevels().some((level) => !state.claimErrors[level])
}

export async function sync() {
  if (syncing) {
    syncAgain = true
    return
  }
  if (!navigator.onLine || !hasWork()) return
  syncing = true
  set({ syncing: true, claimErrors: {} }) // retry claims that failed last time
  try {
    const user = await ensureUser()
    const p = state.player
    if (p._owner && p._owner !== user.id) throw new Error('Signed in as a different user; progress stays on this phone.')
    await syncPlayer(user.id)
    await syncPhotos(user.id)
    await syncResults()
    await syncQrScans()
    await syncFinale()
    await syncClaims()
    set({ syncError: null })
  } catch (err) {
    set({ syncError: err?.message || String(err) })
  } finally {
    syncing = false
    set({ syncing: false })
    if (syncAgain) {
      syncAgain = false
      scheduleSync()
    }
  }
}

async function syncPlayer(uid) {
  const p = state.player
  if (!p._dirty) return
  const rev = p._rev
  const updatable = {
    team_name: p.team_name,
    group_size: p.group_size,
    language: p.language,
    collected_letters: p.collected_letters,
  }
  let needsUpdate = p._remote
  if (!p._remote) {
    const { error } = await supabase.from('game_players').insert({ id: p.id, started_at: p.started_at, ...updatable })
    if (error && error.code !== '23505') throw error
    needsUpdate = !!error // already inserted by an earlier, interrupted sync
  }
  if (needsUpdate) {
    const { error } = await supabase.from('game_players').update(updatable).eq('id', p.id)
    if (error) throw error
  }
  patchPlayer({ _remote: true, _owner: uid, _dirty: state.player._rev === rev ? false : state.player._dirty }, { dirty: false })
}

async function syncPhotos(uid) {
  for (const r of Object.values(state.results)) {
    if (!r._photoPending) continue
    const photoRev = r._photoRev
    const blob = await getLocalPhoto(r.stop_id)
    if (!blob) {
      patchResult(r.stop_id, { _photoPending: false }, { dirty: false })
      continue
    }
    // Same sanitising as road reports: only a safe extension survives
    const rawExt = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
    const fileExt = sanitizeFileName(rawExt).replace(/^_+|_+$/g, '') || 'jpg'
    const filePath = `${uid}/${sanitizeFileName(r.stop_id)}-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(filePath, blob, { contentType: blob.type || 'image/jpeg' })
    if (error) throw error
    const current = state.results[r.stop_id]
    patchResult(r.stop_id, {
      photo_url: filePath,
      _photoPending: current._photoRev === photoRev ? false : current._photoPending,
    })
  }
}

// qr_scanned_at is not here on purpose: only verify_qr_scan() may set it
const SERVER_RESULT_FIELDS = ['stop_id', 'letter', 'photo_url', 'answered_correctly', 'attempts', 'hint_used', 'completed_at']

async function syncResults() {
  const dirty = Object.values(state.results).filter((r) => r._dirty)
  if (!dirty.length) return
  const rows = dirty.map((r) => ({
    player_id: state.player.id,
    ...Object.fromEntries(SERVER_RESULT_FIELDS.map((k) => [k, r[k]])),
  }))
  const revs = dirty.map((r) => [r.stop_id, r._rev])
  const { error } = await supabase.from('game_stop_results').upsert(rows, { onConflict: 'player_id,stop_id' })
  if (error) throw error
  for (const [stopId, rev] of revs) {
    if (state.results[stopId]._rev === rev) patchResult(stopId, { _dirty: false }, { dirty: false })
  }
}

async function syncQrScans() {
  for (const r of Object.values(state.results)) {
    if (!r._qrPending) continue
    const { code, lat, lng } = r._qrPending
    const { data, error } = await supabase.rpc('verify_qr_scan', {
      p_player_id: state.player.id,
      p_stop_id: r.stop_id,
      p_code: code,
      p_lat: lat,
      p_lng: lng,
    })
    // P0001 = the function rejected the scan; anything else is a network
    // or server problem, so keep the scan and try again later.
    if (error && error.code !== 'P0001') throw error
    const current = state.results[r.stop_id]
    if (current._qrPending?.code !== code) continue // rescanned meanwhile
    if (error) {
      const needsProof = !current.photo_url && !current._photoPending
      patchResult(
        r.stop_id,
        { _qrPending: null, _qrError: error.message, ...(needsProof && current.completed_at ? { completed_at: null } : {}) },
        { dirty: needsProof && !!current.completed_at }
      )
    } else {
      patchResult(r.stop_id, { _qrPending: null, _qrError: null, qr_scanned_at: data }, { dirty: false })
    }
  }
}

async function syncFinale() {
  const p = state.player
  if (!p._pendingFinale || p.finale_completed_at) return
  if (Object.values(state.results).some((r) => r._dirty || r._qrPending)) return
  const { data, error } = await supabase.rpc('complete_finale', { p_player_id: p.id, p_completed_at: p._pendingFinale })
  if (error) {
    patchPlayer({ _finaleError: error.message }, { dirty: false })
    return
  }
  const row = Array.isArray(data) ? data[0] : data
  patchPlayer({ finale_completed_at: row.finale_completed_at, _pendingFinale: null, _finaleError: null }, { dirty: false })
}

async function syncClaims() {
  if (Object.values(state.results).some((r) => r._dirty || r._qrPending)) return
  for (const level of unclaimedLevels()) {
    if (level === 3 && !state.player.finale_completed_at) continue
    const { data, error } = await supabase.rpc('claim_prize', { p_player_id: state.player.id, p_level: level })
    if (error) {
      if (error.code !== 'P0001') throw error
      set({ claimErrors: { ...state.claimErrors, [level]: error.message } })
      continue
    }
    const claim = Array.isArray(data) ? data[0] : data
    const claimErrors = { ...state.claimErrors }
    delete claimErrors[level]
    set({ claims: { ...state.claims, [level]: claim }, claimErrors })
    persist()
  }
}

// Picks up "redeemed" set by the shop
export async function refreshClaims() {
  if (!state.player?._remote || !navigator.onLine) return
  const { data, error } = await supabase.from('game_prize_claims').select('*').eq('player_id', state.player.id)
  if (error || !data) return
  set({ claims: Object.fromEntries(data.map((c) => [c.level, c])) })
  persist()
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function adminSignIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function adminSignOut() {
  await supabase.auth.signOut()
}

export async function adminUpdateStop(id, patch) {
  const { data, error } = await supabase
    .from('game_stops')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  const stops = { ...state.stops, [id]: data }
  set({ stops })
  db.setItem(STOPS_KEY, stops).catch(() => {})
  return data
}
