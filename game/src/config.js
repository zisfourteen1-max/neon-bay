// Neon Bay — world constants, palette and tuning.
// All numbers live here so the other modules agree on the city.
export const WORLD_W = 3200;
export const WORLD_H = 2400;

// Road grid: 7 avenues (vertical) x 5 streets (horizontal).
export const AVENUES = [240, 640, 1040, 1440, 1840, 2240, 2640];
export const STREETS = [300, 700, 1100, 1500, 1900];
export const ROAD_W = 96;
export const SIDEWALK = 26;

// South shore: sand then water. East edge: docks then water.
export const SAND_TOP = 2060;
export const WATER_TOP = 2280;
export const DOCKS_LEFT = 2900;
export const EAST_WATER_LEFT = 3130;

// Palm Park sits in the middle block (avenues 1040-1440, streets 1100-1500).
export const PARK = { x: 1092, y: 1152, w: 296, h: 296 };

// Named places the missions and the minimap point at.
export const PLACES = {
  garage: { name: "Ray's Garage", x: 700, y: 368, r: 70 },
  docks: { name: 'Neon Docks', x: 2980, y: 1100, r: 80 },
  chopShop: { name: 'Chop Shop', x: 380, y: 1830, r: 70 },
  bank: { name: 'Bay Bank', x: 1440, y: 620, r: 80 },
  hideout: { name: 'Hideout', x: 360, y: 300, r: 70 },
  park: { name: 'Palm Park', x: 1240, y: 1300, r: 90 },
};

export const COLORS = {
  grass: '#5d8a52',
  grassDark: '#527c49',
  asphalt: '#3b404b',
  asphaltDark: '#333743',
  roadLine: '#e8d27a',
  sidewalk: '#b3a186',
  curb: '#8d7d64',
  sand: '#e2c384',
  water: '#1d6d8f',
  waterDeep: '#155a78',
  dockWood: '#8a6a45',
  parkGrass: '#4f8a4a',
  buildingRoof: ['#c96f4a', '#4a7a96', '#8a5f9e', '#b85c7a', '#5f9e7a', '#a84a3a'],
  neon: ['#ff5ea8', '#3ae0ff', '#ffe14a', '#7dff6a', '#ff8a3a'],
};

export const TUNING = {
  playerWalk: 175,
  playerRun: 265,
  playerRadius: 14,
  playerHealth: 100,
  pistolDamage: 34,
  pistolAmmo: 12,
  pistolFireDelay: 0.22,
  pistolReload: 1.1,
  punchDamage: 16,
  punchRange: 46,
  punchDelay: 0.45,
  carAccel: 430,
  carBrake: 700,
  carMaxSpeed: 540,
  carReverseMax: 190,
  carTurn: 2.6,
  carRadius: 17,
  trafficSpeed: 150,
  pedWalk: 55,
  pedFlee: 190,
  copFootSpeed: 205,
  copCarSpeed: 330,
  bustTime: 1.6,
  wantedDecayDelay: 22,
  wantedDecayStep: 6,
  saveEvery: 5,
};

export const CAR_MODELS = [
  { name: 'Comet GT', color: '#ffd23e', gold: true, speed: 1.12 },
  { name: 'Sunset Coupe', color: '#ff5e6a', speed: 1.05 },
  { name: 'Bay Sedan', color: '#4aa3ff', speed: 0.95 },
  { name: 'Palm Taxi', color: '#ffd23e', taxi: true, speed: 0.9 },
  { name: 'Dune Pickup', color: '#7dff6a', speed: 0.92 },
  { name: 'Marina Van', color: '#c9c9c9', speed: 0.85 },
  { name: 'Neon Sport', color: '#ff5ea8', speed: 1.1 },
  { name: 'Coral Hatch', color: '#ff8a3a', speed: 0.92 },
];

export const SIGNS = ['TACOS', 'HOTEL', 'BAR', '24H', 'PIZZA', 'MOTEL', 'GYM', 'CLUB', 'DONUTS', 'PAWN', 'SUSHI', 'NEON', 'CAFE', 'MART'];
