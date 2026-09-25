import { animate } from 'motion'
import { glagoliticSrc } from '../structure'

// The flying letter (about 2.5 s):
//  1. appears exactly over `fromEl`, rises to the middle of the screen and
//     grows to 2.6x with a gold glow (650 ms),
//  2. flips in 3D from the Latin letter to its Glagolitic glyph (520 ms),
//  3. splits: one copy flies to every slot in `slotEls` (110 ms stagger,
//     720 ms each), shrinking to slot size; `onLand(slotEl)` runs as each
//     copy lands and the copy is removed.
// It lives in a fixed-position layer on document.body so it can fly over any
// layout. Only transform and opacity are animated (compositor-only, keeps
// 60 fps on mid-range Android). With prefers-reduced-motion it just lands.
//
//   await flyLetter({ fromEl, letter, slotEls, onLand })

const SIZE = 40 // px; the flyer is a 40x40 box centred on its translate point
const MID_SCALE = 2.6

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const centreOf = (el) => {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }
}

const at = ({ x, y }, scale) => `translate(${x}px, ${y}px) scale(${scale})`

function makeFlyer(letter) {
  const el = document.createElement('div')
  el.className = 'flyer'
  el.setAttribute('aria-hidden', 'true')
  el.innerHTML = `
    <span class="flyer-face flyer-latin"></span>
    <span class="flyer-face flyer-glag"><span class="glyph" style='--glyph: url("${glagoliticSrc(letter)}")'></span></span>`
  el.querySelector('.flyer-latin').textContent = letter
  document.body.appendChild(el)
  return el
}

export async function flyLetter({ fromEl, letter, slotEls, onLand }) {
  const land = (slot) => onLand?.(slot)
  if (prefersReducedMotion() || !fromEl) {
    slotEls.forEach(land)
    return
  }

  const from = centreOf(fromEl)
  const mid = { x: window.innerWidth / 2, y: window.innerHeight * 0.5 }
  const flyer = makeFlyer(letter)
  const startScale = Math.max(0.5, Math.min(1.2, from.h / SIZE))

  try {
    // 1. rise and grow
    await animate(
      flyer,
      { transform: [at(from, startScale), at(mid, MID_SCALE)], opacity: [0, 1] },
      { duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }
    )

    // 2. flip: Latin front turns away, Glagolitic back turns to face us
    const latin = flyer.querySelector('.flyer-latin')
    const glag = flyer.querySelector('.flyer-glag')
    await Promise.all([
      animate(latin, { transform: ['rotateY(0deg)', 'rotateY(-180deg)'] }, { duration: 0.52, ease: 'easeInOut' }),
      animate(glag, { transform: ['rotateY(180deg)', 'rotateY(0deg)'] }, { duration: 0.52, ease: 'easeInOut' }),
    ])
    await new Promise((r) => setTimeout(r, 120))

    // 3. split and fly to every slot of this letter
    await Promise.all(
      slotEls.map(async (slot, k) => {
        const copy = k === 0 ? flyer : flyer.cloneNode(true)
        if (k > 0) document.body.appendChild(copy)
        const to = centreOf(slot)
        const endScale = Math.max(0.3, to.h / SIZE)
        await animate(
          copy,
          { transform: [at(mid, MID_SCALE), at(to, endScale)] },
          { duration: 0.72, delay: k * 0.11, ease: [0.5, 0, 0.2, 1] }
        )
        land(slot)
        copy.remove()
      })
    )
  } finally {
    flyer.remove()
  }
}

// Slot pop when a letter lands (CSS animation on the glyph, which React never
// re-classes, so the pop survives the state update that follows).
export function popSlot(slot) {
  slot.classList.add('slot--filled')
  const glyph = slot.querySelector('.slot-glyph')
  if (!glyph) return
  glyph.classList.remove('slot-glyph--pop')
  void glyph.offsetWidth // restart the animation
  glyph.classList.add('slot-glyph--pop')
}
