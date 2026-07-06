export const BRAC_POIS = [
  {
    id: 'vidova-gora',
    name: 'Vidova Gora Peak & Viewpoint',
    category: 'viewpoint',
    subCategories: ['photo_spot', 'bike_highlight'],
    coordinates: { lat: 43.2811, lng: 16.6369 },
    township: 'nerezisca',
    elevation: 778,
    accessibility: 'Hard Climb / Asphalt Road Access',
    amenities: ['parking', 'bench'],
    shortDesc: 'The highest peak of all Adriatic islands, offering an unmatched panoramic view.',
    story:
      "Named after the early Christian chapel of St. Vitus (Sutvid) which lies in ruins near the summit, Vidova Gora isn't just a view—it is a sacred vantage point. In Slavic mythology, the god Svantovid saw everything in the cosmos from his high perch. Standing here looking down at Zlatni Rat, it's easy to see why ancients believed this peak held cosmic sight. For cyclists, conquering this 778-meter ascent through the dense, high-altitude black pine forests is the ultimate badge of honor on Brač.",
  },
  {
    id: 'smrka-tunnel',
    name: 'Smrka Submarine Tunnel',
    category: 'military',
    subCategories: ['photo_spot', 'beach_cove'],
    coordinates: { lat: 43.2678, lng: 16.5822 },
    township: 'nerezisca',
    elevation: 0,
    accessibility: 'Slick Macadam / Demanding Gravel Track',
    amenities: ['sea_access'],
    shortDesc: 'A Cold War underground naval hangar carved directly out of the coastal cliffs.',
    story:
      'Cut into the jagged southern cliffs during the Yugoslav era under Tito, this massive sea tunnel was designed to hide tactical submarines and torpedo boats from aerial surveillance. The entrance mechanism even featured camouflage mesh hooks to blend the concrete vault into the natural limestone walls. Today, it is totally abandoned. Coasting your mountain bike deep into the dark, eerie concrete cavern while the sea laps against the blast walls is an unforgettable, surreal experience.',
  },
  {
    id: 'nerezi-pine',
    name: 'The Roof Pine of Nerežišća',
    category: 'nature_monument',
    subCategories: ['photo_spot'],
    coordinates: { lat: 43.3324, lng: 16.5741 },
    township: 'nerezisca',
    elevation: 382,
    accessibility: 'Easy Town Center Asphalt',
    amenities: ['water_fountain', 'shops'],
    shortDesc: 'A small, living Dalmatian black pine sprouting directly from the stone roof of St. Peter\'s chapel.',
    story:
      'Growing straight out of the stone apse tiles of the tiny 14th-century chapel of St. Peter, this miniature black pine is a living bonsai and a symbol of island survival. For well over a century, it has sprouted without soil, drawing moisture strictly from the ancient mortar and humid island air. Locals call it a miracle, but botanically it represents the unyielding, stubborn strength of Brač nature—clinging to bare rock and refusing to die.',
  },
]

export const BRAC_POI_SCHEMA = {
  id: 'string',
  name: 'string',
  category: 'string',
  subCategories: 'string[]',
  coordinates: '{ lat: number, lng: number }',
  township: 'string',
  elevation: 'number',
  accessibility: 'string',
  amenities: 'string[]',
  shortDesc: 'string',
  story: 'string',
}
