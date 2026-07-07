export const explorerPois = [
  {
    id: 'blaca-hermitage',
    name: 'Blaca Hermitage (Pustinja Blaca)',
    category: 'monastery',
    township: 'nerezisca',
    shortDesc: 'A breathtaking 16th-century monastery carved entirely into a sheer canyon cliffside.',
    story:
      'Founded in 1551 by two Glagolitic monks fleeing the Ottoman invasion, Blaca began as a simple stone cave. Over centuries it evolved into a world-class monastery with a library, a printing press, and an observatory. The monks survived on steep valley slopes by farming grapes and harvesting honey, and their isolated setting still feels mysterious and cinematic today.',
    imagePlaceholderColor: '#511b85',
  },
  {
    id: 'zlatni-rat',
    name: 'Zlatni Rat',
    category: 'beach_cove',
    township: 'bol',
    shortDesc: 'A striking horn-shaped pebble beach where the sea shifts shape with every breeze.',
    story:
      'Zlatni Rat is the island’s most famous postcard view: a long, changing sand-and-pebble tongue that seems to move with the tide and wind. Cyclists often use it as a reward after a long ride along the southern coast, where the sea turns from teal to deep blue in a single glance.',
    imagePlaceholderColor: '#2b8ac7',
  },
  {
    id: 'vidova-gora',
    name: 'Vidova Gora Viewpoint',
    category: 'viewpoint',
    township: 'nerezisca',
    shortDesc: 'The highest peak on the Adriatic and one of the most dramatic panoramic stops on Brač.',
    story:
      'From the summit, the island unfurls like a map of stone, sea, and wind. The climb is legendary among riders, and the view over Zlatni Rat and the surrounding coastline feels almost mythic at sunrise when the light paints the ridge in gold.',
    imagePlaceholderColor: '#6e3ea8',
  },
  {
    id: 'pucisca-stone-heritage',
    name: 'Pučišća Stone Heritage',
    category: 'stone_heritage',
    township: 'pucisca',
    shortDesc: 'The island’s ancient marble heart, where the stone tradition shaped Brač for centuries.',
    story:
      'Pučišća has long been known for its quarrying traditions, and its white stone still defines the architecture of the island. Walking through the town feels like stepping inside a living catalogue of Brač’s craftsmanship, where every façade and threshold carries the memory of carved stone.',
    imagePlaceholderColor: '#7f4fa8',
  },
  {
    id: 'dol-village',
    name: 'Dol Village',
    category: 'village',
    township: 'dol',
    shortDesc: 'A calm inland village wrapped in olive groves, stone houses, and slow island rhythms.',
    story:
      'Dol is one of Brač’s most peaceful corners, where the route narrows into green lanes and the air feels cooler than the coast. It’s the kind of place that rewards the cyclist who slows down and notices the small details—terraces, old walls, and gardens that seem to grow straight from the rock.',
    imagePlaceholderColor: '#5a3e7a',
  },
  {
    id: 'postira-bay',
    name: 'Postira Bay',
    category: 'beach_cove',
    township: 'postira',
    shortDesc: 'A relaxed shoreline stop with clear water, easy access, and a breezy coastal atmosphere.',
    story:
      'Postira is beloved for its gentle bay, where a swim can feel like a reset after a long ride. The village has a warm, local energy, and the shorelines around it are ideal for a pause that feels both scenic and unhurried.',
    imagePlaceholderColor: '#3f7db3',
  },
  {
    id: 'stina-seafood',
    name: 'Stina',
    category: 'gastro',
    township: 'stina',
    shortDesc: 'A beloved island stop for seafood, local wine, and a properly slow evening by the sea.',
    story:
      'Stina is one of Brač’s most atmospheric places to linger after a ride, with fresh fish, island vegetables, and coastal views that help the evening stretch longer. It is a reminder that some of the best island memories are built around a table, a glass of local wine, and a sunset that refuses to hurry.',
    imagePlaceholderColor: '#7a2c5b',
  },
  {
    id: 'bast-tavern',
    name: 'Bast Tavern',
    category: 'gastro',
    township: 'bast',
    shortDesc: 'A cozy inland tavern where grilled specialties and Brač hospitality shine.',
    story:
      'In the heart of the island’s quieter interior, Bast offers hearty dishes, olive oil, and the kind of welcome that makes a ride feel complete. It is the perfect place to refuel with something simple, generous, and deeply local before heading back to the coast.',
    imagePlaceholderColor: '#b36f61',
  },
]

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
