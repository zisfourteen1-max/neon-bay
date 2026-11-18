// NEON BAY — tuning constants and the city's palette.
// A sun-soaked coastal city, drawn top-down on one canvas. Everything here is
// original: the city, the names, the cars, the people. No real places or brands.
export const WORLD = { w: 3200, h: 2400 };

export const ROAD_W = 72;
export const AVENUES = [400, 800, 1200, 1600, 2000, 2400, 2800];
export const STREETS = [400, 800, 1200, 1600, 2000];
export const BEACH_Y = 2180;
export const WATER_Y = 2310;
export const DOCK_X = 2920;

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  runSpeed: 300,
  maxHealth: 100,
  pistolDamage: 34,
  pistolRange: 420,
  pistolCooldown: 0.22,
  reloadTime: 0.9,
  magSize: 12,
  punchDamage: 18,
  punchRange: 42,
  punchCooldown: 0.45,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 700,
  maxSpeed: 430,
  maxReverse: 160,
  turnRate: 2.6,
  trafficSpeed: 130,
  policeSpeed: 330,
};

export const POLICE = {
  footSpeed: 185,
  bustRadius: 34,
  bustTime: 1.6,
  wantedDecayDelay: 22,
  wantedDecayStep: 8,
};

export const PALETTE = {
  grass: '#7fb069',
  grassDark: '#6da25c',
  road: '#3a3f4a',
  roadLine: '#e8c85a',
  sidewalk: '#b9b3a4',
  buildingRoof: ['#c96f4a', '#4a7fb5', '#8a6fb5', '#4a9e7a', '#b5a44a', '#a04a5e'],
  buildingEdge: '#2e2a26',
  sand: '#e8d29a',
  water: '#2f7fb5',
  waterDeep: '#1f5d8a',
  park: '#5d9e4f',
  dock: '#8a7a5e',
  plaza: '#c9c2b2',
  carColors: ['#d94f3d', '#3d7bd9', '#e8b13d', '#3da06a', '#8a4fd9', '#e8e8e8', '#222831', '#d97b3d'],
  policeCar: '#2b4a8a',
  goldCar: '#d9a521',
};

export const WANTED_NAMES = ['Clean', 'Wanted', 'Heat', 'Hot', 'ManHunt', 'Lockdown'];
export const START_MONEY = 120;
export const SAVE_KEY = 'neonbay-save-v1';
