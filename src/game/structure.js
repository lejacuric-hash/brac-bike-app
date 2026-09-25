// Language-independent shape of "Lodina abeceda". Text lives in
// content/hr.js and content/en.js (same stop ids); coordinates live in the
// Supabase game_stops table (seeded from stops.js).

// 20 stops, 5 games, one letter each (from content/answers.md). The order
// within a game is the loop order in the content: each stop's clue leads to
// the next one.
export const STOPS = [
  { id: 'supetar_mausoleum', game: 1, letter: 'T' },
  { id: 'likva', game: 1, letter: 'O' },
  { id: 'sutivan_monument', game: 1, letter: 'Č' },
  { id: 'rasohe', game: 1, letter: 'E' },
  { id: 'lozisca', game: 2, letter: 'Z' },
  { id: 'bobovisca', game: 2, letter: 'B' },
  { id: 'milna', game: 2, letter: 'L' },
  { id: 'dracevica', game: 2, letter: 'D' },
  { id: 'kopacina', game: 3, letter: 'A' },
  { id: 'skrip', game: 3, letter: 'I' },
  { id: 'postira', game: 3, letter: 'V' },
  { id: 'dol', game: 3, letter: 'H' },
  { id: 'nerezisca', game: 4, letter: 'Đ' },
  { id: 'nerezisca_plain', game: 4, letter: 'U' },
  { id: 'koloc', game: 4, letter: 'N' },
  { id: 'zlatni_rat', game: 5, letter: 'Ž' },
  { id: 'dominicans_bol', game: 5, letter: 'J' },
  { id: 'dragon_cave', game: 5, letter: 'M' },
  { id: 'blaca', game: 5, letter: 'Š' },
  { id: 'vidova_gora', game: 5, letter: 'S' },
]

export const GAME_IDS = [1, 2, 3, 4, 5]
export const ALL_LETTERS = STOPS.map((s) => s.letter)

export const getStop = (id) => STOPS.find((s) => s.id === id)
export const stopsOfGame = (gameId) => STOPS.filter((s) => s.game === Number(gameId))
export const stopForLetter = (letter) => STOPS.find((s) => s.letter === letter)

// The previous stop in the game's loop: its clue leads to this stop.
export function previousStop(stopId) {
  const stop = getStop(stopId)
  const list = stopsOfGame(stop.game)
  const i = list.findIndex((s) => s.id === stopId)
  return i > 0 ? list[i - 1] : null
}

// Nazor's sentence as it appears in the bar: 16 words, 64 letter slots.
export const SENTENCE = [
  ['OTOČE', ''], ['BEZ', ''], ['VODE', ','], ['HVALA', ''], ['TI', ','],
  ['ŠTO', ''], ['ME', ''], ['NAUČI', ''], ['ŽEĐATI', ''], ['I', ''],
  ['ČEZNUTI', ''], ['ZA', ''], ['NEČIM', ''], ['ČITAV', ''], ['SVOJ', ''], ['ŽIVOT', '.'],
].map(([word, punct]) => ({ word, punct, letters: [...word] }))

// The 12 words that unlock (answers.md), in sentence order; these are also the
// finale tiles. `punct` follows the unit in the English line.
export const UNITS = [
  ['OTOČE', ''], ['BEZ', ''], ['VODE', ','], ['HVALA TI', ','], ['ŠTO ME', ''], ['NAUČI', ''],
  ['ŽEĐATI', ''], ['I', ''], ['ČEZNUTI', ''], ['ZA NEČIM', ''], ['ČITAV SVOJ', ''], ['ŽIVOT', '.'],
].map(([word, punct]) => ({ word, punct, letters: [...new Set(word.replace(/ /g, ''))] }))

export const isUnitUnlocked = (unit, collected) => unit.letters.every((l) => collected.includes(l))

// Prize levels (answers.md)
export const PRIZE_LEVELS = [
  { level: 1, letters: ['O', 'T', 'Č', 'E'], words: 'OTOČE' },
  { level: 2, letters: ['O', 'T', 'Č', 'E', 'Z', 'B', 'L', 'D', 'A', 'I', 'V', 'H'], words: 'OTOČE BEZ VODE, HVALA TI' },
  { level: 3, letters: ALL_LETTERS, words: null, needsFinale: true },
]

// Stops whose last part is walked; the bike route ends at the trailhead
export const ON_FOOT = new Set(['rasohe', 'kopacina', 'koloc', 'dragon_cave', 'blaca'])

// Latin letter → Glagolitic SVG file (public/glagolitic/<file>.svg)
export const GLAGOLITIC_FILES = {
  A: 'a', B: 'b', Č: 'ch', D: 'd', Đ: 'dj', E: 'e', H: 'h', I: 'i', J: 'j', L: 'l',
  M: 'm', N: 'n', O: 'o', S: 's', Š: 'sh', T: 't', U: 'u', V: 'v', Z: 'z', Ž: 'zh',
}
export const glagoliticSrc = (letter) => `/glagolitic/${GLAGOLITIC_FILES[letter]}.svg`

// C = Č, D = Đ, Z = Ž, S = Š: compare letters without diacritics
export const baseLetter = (ch) =>
  ch.toUpperCase().replace(/Đ/g, 'D').normalize('NFD').replace(/[̀-ͯ]/g, '')
