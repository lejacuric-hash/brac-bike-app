// Parses content/hr.md, content/en.md and content/answers.md into
// src/game/content/{hr,en}.js for "Izgubljene kronike: Lodina abeceda".
// Text is copied verbatim. The only edits are:
//  - organiser-only notes listed in NOTE_REMOVALS,
//  - the "Uzmi drugo/treće slovo." endings of Croatian questions (the letter
//    now flies out of the answer by itself),
//  - the "→ **X** (answer)" tails of the questions.
// Stop IDs, letters, the three options and the words come from answers.md.
// The organiser key, launch checklist, partners and sources are not used.
// Run with: npm run build-game-content
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n')

const NOTE_REMOVALS = {
  hr: [
    [' Vezu Donjeg Humca i Škripa treba provjeriti na karti.', ''],
    // stray bold markers in the Game 5 message
    ['najljepše vidike**. Ako imaš', 'najljepše vidike. Ako imaš'],
    ['dođi po veliku nagradu**.*', 'dođi po veliku nagradu.*'],
  ],
  en: [
    [' The road link between Donji Humac and Škrip must be checked on a map.', ''],
  ],
}

const L = {
  hr: {
    game: /^## Igra (\d): (.+)$/,
    east: /^## Izlet na istok/,
    finale: /^## Finale/,
    story: '### Priča',
    letter: /^\*\*Lodino pismo( za rutu)?:\*\*$/,
    stop: /^### Postaja: (.+) → (\S+)$/,
    fields: {
      '**Lodina priča:**': 'story',
      '**Činjenice:**': 'facts',
      '**Pitanje:**': 'question',
      '**Foto-zadatak:**': 'photoTask',
      '**Trag:**': 'clue',
      '**Trag za povratak:**': 'returnClue',
      '**Lodina poruka:**': 'endMessage',
    },
    bonus: /^\*\*Bonus prič[ae]( [^*]+)?:\*\*\s*(.*)$/,
    lastLetter: '**Lodino posljednje pismo:**',
    prizesNote: '**Tri nagrade usput:**',
    finalPlace: '**Završno mjesto (neobavezno):**',
    questionEnding: /\s*Uzmi (drugo|treće) slovo\.$/,
  },
  en: {
    game: /^## Game (\d): (.+)$/,
    east: /^## An optional trip to the east/,
    finale: /^## Finale/,
    story: '### The story',
    letter: /^\*\*Loda's letter:\*\*$/,
    stop: /^### Stop: (.+) → (\S+)$/,
    fields: {
      "**Loda's story:**": 'story',
      '**Facts:**': 'facts',
      '**Question:**': 'question',
      '**Photo task:**': 'photoTask',
      '**Clue:**': 'clue',
      '**Clue for the ride back:**': 'returnClue',
      "**Loda's message:**": 'endMessage',
    },
    bonus: /^\*\*Bonus stor(?:y|ies)( [^*]+)?:\*\*\s*(.*)$/,
    lastLetter: "**Loda's last letter:**",
    prizesNote: '**Three prizes along the way:**',
    finalPlace: '**Final place (optional):**',
    questionEnding: null,
  },
}

const unescape = (s) => s.replace(/\\([_.*])/g, '$1').trim()
const stripItalic = (s) => {
  const t = s.trim()
  return t.startsWith('*') && t.endsWith('*') && !t.startsWith('**') ? t.slice(1, -1).trim() : t
}
const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim())

// ---------------------------------------------------------------------------
// answers.md
// ---------------------------------------------------------------------------
function parseAnswers() {
  const lines = read('content/answers.md').split('\n')
  const section = (title) => {
    const start = lines.findIndex((l) => l.startsWith(title))
    const out = []
    for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i++) out.push(lines[i])
    return out
  }
  const tableRows = (ls) => ls.filter((l) => l.startsWith('|') && !/^\|[-| ]+\|$/.test(l)).slice(1).map(cells)

  const stops = lines
    .filter((l) => /^\| [1-5] \| [a-z_]+ \|/.test(l))
    .map(cells)
    .map(([game, id, name, letter]) => ({ game: Number(game), id, name, letter }))

  const words = tableRows(section('## Words')).map(([word, en, letters]) => ({
    word,
    en,
    letters: letters.split(',').map((x) => x.trim()),
  }))

  const parseOptions = (cell) => {
    const opts = cell.split(' · ').map((o) => o.trim())
    const correctIndex = opts.findIndex((o) => o.startsWith('**') && o.endsWith('**'))
    return { options: opts.map((o) => o.replace(/^\*\*|\*\*$/g, '')), correctIndex }
  }
  const options = {}
  for (const [id, , optsHr, , optsEn] of tableRows(section('## Three answer options'))) {
    options[id] = { hr: parseOptions(optsHr), en: parseOptions(optsEn) }
  }

  const glagolitic = {}
  for (const row of tableRows(section('## Glagolitic SVG files'))) {
    for (let i = 0; i < row.length; i += 2) glagolitic[row[i]] = row[i + 1].replace(/\.svg$/, '')
  }

  const finaleLines = section('## Finale')
  const quoted = (prefix) => {
    const line = finaleLines.find((l) => l.includes(prefix))
    return line.match(/"([^"]+)"/)?.[1] ?? line.match(/\*([^*]+)\*/)?.[1]
  }
  const hint = { hr: quoted('Hint (hr)').trim(), en: finaleLines.find((l) => l.includes('Hint (hr)')).match(/\(en\): "([^"]+)"/)[1] }
  const order = finaleLines.find((l) => l.startsWith('- Correct order:')).replace('- Correct order:', '').split('·').map((w) => w.trim())

  return { stops, words, options, glagolitic, hint, order }
}

// ---------------------------------------------------------------------------
// hr.md / en.md
// ---------------------------------------------------------------------------
function parseMd(lang, answers) {
  let text = read(`content/${lang}.md`)
  for (const [from, to] of NOTE_REMOVALS[lang]) {
    if (!text.includes(from)) throw new Error(`${lang}: note not found: ${from}`)
    text = text.replace(from, to)
  }
  const T = L[lang]
  const lines = text.split('\n').map((l) => l.trimEnd())

  const out = { title: unescape(lines[0].replace(/^# /, '')), games: [], stops: {}, eastTrip: null, finale: {} }

  // "Priča / The story": first two paragraphs (the third is an edition note)
  const storyStart = lines.indexOf(T.story)
  const storyParas = []
  for (let i = storyStart + 1; i < lines.length && !lines[i].startsWith('>') && !lines[i].startsWith('#'); i++) {
    if (lines[i].trim()) storyParas.push(unescape(lines[i]))
  }
  out.story = storyParas.slice(0, 2)
  out.intro = storyParas[0].match(/^.+?\.(?=\s|$)/)[0] // Loda's one-line intro: first sentence

  let section = null // 'game' | 'east' | 'finale'
  let game = null
  let stop = null
  let pending = null // blockquote target
  let quote = []
  let bonusList = null
  let stopIndexInGame = 0

  const flushQuote = () => {
    if (!quote.length) return
    if (!pending) { quote = []; return } // a quote nobody asked for (e.g. the sentence in "Priča")
    const paras = []
    let cur = []
    for (const q of quote) {
      if (q === '') { if (cur.length) paras.push(cur.join(' ')); cur = [] } else cur.push(q)
    }
    if (cur.length) paras.push(cur.join(' '))
    pending(paras.map((p) => stripItalic(unescape(p))))
    quote = []
    pending = null
  }

  for (const line of lines) {
    if (line.startsWith('>')) { quote.push(line.replace(/^>\s?/, '').trim()); continue }
    flushQuote()

    const gm = line.match(T.game)
    if (gm) {
      const [title, subtitle] = gm[2].split(' – ')
      game = { id: Number(gm[1]), title: title.trim(), subtitle: subtitle?.trim() ?? '', meta: [], stops: [] }
      out.games.push(game)
      section = 'game'
      stop = null
      stopIndexInGame = 0
      continue
    }
    if (T.east.test(line)) { section = 'east'; game = null; stop = null; out.eastTrip = { title: line.replace(/^## /, ''), intro: '', places: [] }; continue }
    if (T.finale.test(line)) { section = 'finale'; game = null; stop = null; out.finale.title = line.replace(/^## /, ''); continue }
    if (line.startsWith('## ')) { section = null; game = null; stop = null; continue }
    if (!section) continue

    if (section === 'east') {
      if (line.startsWith('- ')) out.eastTrip.places.push(unescape(line.slice(2)))
      else if (line.trim() && !out.eastTrip.intro) out.eastTrip.intro = unescape(line)
      continue
    }

    if (section === 'finale') {
      if (line === T.lastLetter) { pending = (p) => { out.finale.lodaLastLetter = p } ; continue }
      if (line.startsWith(T.prizesNote)) { out.finale.prizesNote = unescape(line.slice(T.prizesNote.length)); continue }
      if (line.startsWith(T.finalPlace)) { out.finale.finalPlace = unescape(line.slice(T.finalPlace.length)); continue }
      if (line.trim() && !out.finale.intro && !line.startsWith('**')) out.finale.intro = unescape(line)
      continue
    }

    // --- games
    const sm = line.match(T.stop)
    if (sm) {
      const expected = answers.stops.filter((s) => s.game === game.id)[stopIndexInGame++]
      if (!expected) throw new Error(`${lang}: unexpected stop ${sm[1]}`)
      if (expected.letter !== sm[2]) throw new Error(`${lang}: ${expected.id} letter ${sm[2]} vs ${expected.letter} in answers.md`)
      stop = { id: expected.id, game: game.id, letter: expected.letter, name: unescape(sm[1]), bonusStories: [] }
      out.stops[stop.id] = stop
      game.stops.push(stop.id)
      bonusList = null
      continue
    }
    if (T.letter.test(line)) { pending = (p) => { game.lettersIntro = p }; continue }

    if (!stop) {
      const meta = line.match(/^\*\*([^*]+):\*\*\s*(.+)$/)
      if (meta) game.meta.push({ label: meta[1], text: unescape(meta[2]) })
      continue
    }

    if (bonusList && line.startsWith('- ')) { stop.bonusStories.push(unescape(line.slice(2))); continue }
    if (bonusList && line.trim() && !line.startsWith('- ')) bonusList = null

    const bm = line.match(T.bonus)
    if (bm) {
      if (bm[2]) stop.bonusStories.push(unescape(bm[2]))
      else bonusList = true
      continue
    }

    for (const [prefix, key] of Object.entries(T.fields)) {
      if (!line.startsWith(prefix)) continue
      let value = unescape(line.slice(prefix.length))
      if (key === 'question') {
        const [q, tail] = value.split(' → ')
        const mdLetter = tail?.match(/\*\*(\S+)\*\*/)?.[1]
        if (mdLetter !== stop.letter) throw new Error(`${lang}: ${stop.id} question letter ${mdLetter}`)
        value = T.questionEnding ? q.replace(T.questionEnding, '') : q
        stop.question = value.trim()
      } else if (key === 'endMessage') {
        game.endMessage = stripItalic(value)
      } else if (key === 'clue' || key === 'returnClue') {
        stop.clue = stripItalic(value)
        stop.clueIsReturn = key === 'returnClue'
      } else {
        stop[key] = key === 'story' ? stripItalic(value) : value
      }
    }
  }
  flushQuote()

  // Options, correct answer and words from answers.md
  for (const s of Object.values(out.stops)) {
    const o = answers.options[s.id]?.[lang]
    if (!o || o.options.length !== 3 || o.correctIndex < 0) throw new Error(`${lang}: ${s.id} options`)
    s.options = o.options
    s.correctIndex = o.correctIndex
    // clue is optional: the last stop of Game 1 has none
    for (const k of ['name', 'story', 'facts', 'question', 'photoTask']) {
      if (!s[k]) throw new Error(`${lang}: ${s.id} missing ${k}`)
    }
  }
  for (const g of out.games) {
    for (const k of ['lettersIntro', 'endMessage']) if (!g[k]) throw new Error(`${lang}: game ${g.id} missing ${k}`)
  }
  if (out.games.length !== 5 || Object.keys(out.stops).length !== 20) throw new Error(`${lang}: expected 5 games / 20 stops`)

  // The two lines of the sentence (the quote after the finale placeholder)
  const sentenceBlock = text.slice(text.indexOf(out.finale.title)).match(/> \*\*\*(.+?)\*\*\*\n>\n> \*(.+?)\*/)
  out.finale.sentence = sentenceBlock[1]
  out.finale.translation = sentenceBlock[2]
  out.finale.hint = answers.hint[lang]
  out.finale.order = answers.order
  for (const k of ['intro', 'lodaLastLetter', 'sentence', 'translation', 'finalPlace', 'prizesNote']) {
    if (!out.finale[k]) throw new Error(`${lang}: finale missing ${k}`)
  }
  return out
}

const answers = parseAnswers()
if (answers.stops.length !== 20) throw new Error('answers.md: expected 20 stops')

for (const lang of ['hr', 'en']) {
  const data = parseMd(lang, answers)
  data.words = answers.words
  data.glagolitic = answers.glagolitic
  const out = `// Generated from content/${lang}.md and content/answers.md — text is verbatim.
// Organiser-only sections are left out; edit the markdown and run
// \`npm run build-game-content\` rather than editing this file by hand.
const content = ${JSON.stringify(data, null, 2)}

export default content
`
  fs.writeFileSync(path.join(root, `src/game/content/${lang}.js`), out)
  console.log(lang, 'games', data.games.length, 'stops', Object.keys(data.stops).length, 'words', data.words.length)
}
