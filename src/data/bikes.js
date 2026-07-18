export const bikes = [
  {
    id: 'ghost-kato',
    name: 'Ghost Kato Universal 29',
    category: 'bike',
    type: 'Mountain Bike',
    sizes: ['S', 'M', 'L', 'XL'],
    image: 'ghost-kato.webp',
    specUrl: 'https://r-and-r.eu/rent-a-bike/ghost-kato-universal-29/',
    specs: [
      'Frame: Ghost aluminium',
      'Wheel: 29"',
      'Gears: 21 speed',
      'Brakes: Hydraulic disc',
      'Suspension: Front fork',
    ],
    description: 'Perfect for trails and mountain roads on Brač.',
  },
  {
    id: 'sprint-whisper',
    name: 'Sprint Whisper GRX600 Gravel',
    category: 'bike',
    type: 'Gravel Bike',
    sizes: ['L'],
    image: 'sprint-whisper.webp',
    specUrl: 'https://r-and-r.eu/rent-a-bike/sprint-whisper-grx600-gravel/',
    specs: [
      'Frame: Sprint aluminium',
      'Wheel: 700c',
      'Gears: Shimano GRX600',
      'Brakes: Hydraulic disc',
      'Suspension: Rigid',
    ],
    description: 'Ideal for gravel roads and longer island tours.',
  },
  {
    id: 'haibike-hardnine',
    name: 'Haibike Hardnine 6',
    category: 'ebike',
    type: 'E-MTB Hardtail',
    sizes: ['S', 'M', 'L', 'XL'],
    image: 'haibike-hardnine.webp',
    specUrl: 'https://r-and-r.eu/rent-a-bike/',
    specs: [
      'Motor: Yamaha PW-ST',
      'Battery: 500Wh',
      'Wheel: 29"',
      'Gears: 11 speed',
      'Suspension: Front fork',
    ],
    description: 'Powerful e-MTB for tackling Brač hills with ease.',
  },
  {
    id: 'haibike-allmtn',
    name: 'Haibike Allmtn 2',
    category: 'ebike',
    type: 'E-MTB Full Suspension',
    sizes: ['S', 'L'],
    image: 'haibike-allmtn.webp',
    specUrl: 'https://r-and-r.eu/rent-a-bike/',
    specs: [
      'Motor: Yamaha PW-ST',
      'Battery: 500Wh',
      'Wheel: 29"',
      'Gears: 11 speed',
      'Suspension: Full suspension',
    ],
    description: 'Full suspension e-MTB for the most technical terrain.',
  },
  {
    id: 'haibike-trekking',
    name: 'Haibike Trekking Low 4',
    category: 'ebike',
    type: 'E-Trekking',
    sizes: ['S', 'M'],
    image: 'haibike-trekking.webp',
    specUrl: 'https://r-and-r.eu/rent-a-bike/',
    specs: [
      'Motor: Yamaha PW-TE',
      'Battery: 500Wh',
      'Wheel: 28"',
      'Gears: 9 speed',
      'Suspension: Front fork',
    ],
    description: 'Comfortable e-trekking bike, great for relaxed island exploration.',
  },
]

export const extras = [
  { id: 'helmet', label: 'Helmet', price: 0 },
  { id: 'lock', label: 'Lock', price: 0 },
  { id: 'child-seat', label: 'Child Seat', price: 0 },
  { id: 'lights', label: 'Lights', price: 0 },
  { id: 'spd-pedals', label: 'SPD Pedals', price: 0 },
]

export const deliveryZones = [
  {
    id: 'zone0',
    label: 'Zone 0 — Supetar (pickup at our location)',
    oneWay: 0,
    bothWays: 0,
    locations: ['Supetar'],
  },
  {
    id: 'zone1',
    label: 'Zone 1 — Sutivan, Mirca, Splitska, Donji Humac, Nerežišća',
    oneWay: 20,
    bothWays: 30,
    locations: ['Sutivan', 'Mirca', 'Splitska', 'Donji Humac', 'Nerežišća'],
  },
  {
    id: 'zone2',
    label: 'Zone 2 — Škrip, Postira, Ložišća, Dračevica, Bobovišća',
    oneWay: 25,
    bothWays: 35,
    locations: ['Škrip', 'Postira', 'Ložišća', 'Dračevica', 'Bobovišća'],
  },
  {
    id: 'zone3',
    label: 'Zone 3 — Milna, Pražnica, Pučišća, Gornji Humac',
    oneWay: 35,
    bothWays: 45,
    locations: ['Milna', 'Pražnica', 'Pučišća', 'Gornji Humac'],
  },
  {
    id: 'zone4',
    label: 'Zone 4 — Bol, Selca, Murvica, Sumartin, Povlja, Novo Selo',
    oneWay: 55,
    bothWays: 65,
    locations: ['Bol', 'Selca', 'Murvica', 'Sumartin', 'Povlja', 'Novo Selo'],
  },
]

export const bikePricing = {
  bike: {
    hourly: { 1: 6, 3: 12, 6: 15, 12: 18, 24: 20 },
    multiDay: { 3: 18, 7: 12 },
  },
  ebike: {
    hourly: { 3: 25, 6: 33, 12: 36, 24: 40 },
    multiDay: { 3: 36, 7: 33 },
  },
}