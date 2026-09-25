import { ON_FOOT, STOPS } from './structure'

// DRAFT coordinates from content/stops-coordinates.md. The game reads the
// live values from the Supabase game_stops table (seeded with these same
// numbers, then corrected on site with the admin screen); this list is only
// the offline fallback for a first launch with no signal.
const DRAFT = {
  supetar_mausoleum: [43.3855, 16.5445, 'Supetar – Petrinović mausoleum, St Nicholas peninsula'],
  likva: [43.387, 16.5, 'Likva Bay (K-Pg boundary)'],
  sutivan_monument: [43.3842, 16.4814, 'Sutivan – emigration monument, central park'],
  rasohe: [43.362, 16.607, 'Splitska – Rasohe quarry, Hercules relief'],
  lozisca: [43.3469, 16.4803, "Ložišća – Rendić's bell tower"],
  bobovisca: [43.352, 16.463, 'Bobovišća na Moru – Gligo castle, Vičja Luka'],
  milna: [43.3265, 16.4495, 'Milna – harbour and church of Our Lady of the Annunciation'],
  dracevica: [43.329, 16.542, 'Dračevica – village and windmill'],
  kopacina: [43.331, 16.596, 'Kopačina Cave plateau near Donji Humac'],
  skrip: [43.35, 16.6, 'Škrip – Brač Island Museum, Radojković tower'],
  postira: [43.3775, 16.631, "Postira – Nazor's birth house"],
  dol: [43.362, 16.629, 'Dol – hrapoćuša caves'],
  nerezisca: [43.333, 16.583, 'Nerežišća – edge of the village, dry-stone walls'],
  nerezisca_plain: [43.33, 16.575, 'Nerežišća plain – prehistoric mounds'],
  koloc: [43.325, 16.57, 'Koloč rock, SW of Nerežišća'],
  zlatni_rat: [43.2558, 16.6338, 'Zlatni Rat – tip of the spit'],
  dominicans_bol: [43.2598, 16.662, 'Bol – Dominican monastery'],
  dragon_cave: [43.2693, 16.599, "Dragon's Cave above Murvica"],
  blaca: [43.2873, 16.543, 'Blaca Hermitage'],
  vidova_gora: [43.28, 16.618, 'Vidova gora – summit viewpoint'],
}

// Larger unlock radius for wide or hard-to-pin places (stops-coordinates.md)
const RADIUS = { zlatni_rat: 200, vidova_gora: 200, blaca: 300, nerezisca_plain: 300 }

export const STOP_SEED = STOPS.map(({ id, game, letter }) => ({
  id,
  game,
  letter,
  name: DRAFT[id][2],
  lat: DRAFT[id][0],
  lng: DRAFT[id][1],
  radius_m: RADIUS[id] ?? 100,
  verified: false,
  on_foot: ON_FOOT.has(id),
  trailhead_lat: null,
  trailhead_lng: null,
  qr_required: false,
}))
