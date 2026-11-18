// NEON BAY — the whole game state in one place: the player, every car,
// pedestrian and cop, the wanted level, the mission progress and the particles.
import { AVENUES, CAR, PALETTE, PLAYER, START_MONEY, STREETS, WORLD } from './config.js';
import { buildCity, hitsBuilding, onRoad } from './city.js';
import { clamp, makeRng } from './random.js';

let nextId = 1;

export function makeCar(rng, x, y, angle, opts) {
  const o = opts || {};
  return {
    id: nextId += 1,
    x,
    y,
    angle,
    speed: 0,
    color: o.color || rng.pick(PALETTE.carColors),
    kind: o.kind || 'sedan',
    traffic: !!o.traffic,
    parked: !!o.parked,
    police: !!o.police,
    gold: !!o.gold,
    dir: o.dir || 0, // 0 east, 1 south, 2 west, 3 north (traffic cars)
    targetSpeed: o.traffic ? CAR.trafficSpeed * rng.range(0.8, 1.15) : 0,
    driver: o.traffic ? { skin: rng.pick(['#e8b58a', '#c98a5e', '#8a5a3a', '#f0c8a0']), shirt: rng.pick(['#d94f3d', '#3d7bd9', '#3da06a', '#e8e8e8']) } : null,
    brakeLight: false,
  };
}

export function makePed(rng, x, y) {
  return {
    id: nextId += 1,
    x,
    y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(45, 75),
    skin: rng.pick(['#e8b58a', '#c98a5e', '#8a5a3a', '#f0c8a0']),
    shirt: rng.pick(['#d94f3d', '#3d7bd9', '#3da06a', '#e8b13d', '#8a4fd9', '#e8e8e8']),
    flee: 0,
    target: null,
    walkPhase: rng.range(0, Math.PI * 2),
  };
}

export function makeCop(rng, x, y, inCar) {
  return {
    id: nextId += 1,
    x,
    y,
    angle: 0,
    speed: 0,
    inCar: !!inCar,
    bustTimer: 0,
    car: null,
  };
}

function randomRoadPoint(rng) {
  if (rng.chance(0.5)) {
    return { x: rng.pick(AVENUES), y: rng.range(120, 2080) };
  }
  return { x: rng.range(120, 2880), y: rng.pick(STREETS) };
}

function randomSidewalkPoint(rng) {
  const p = randomRoadPoint(rng);
  const dx = rng.chance(0.5) ? 52 : -52;
  const dy = rng.chance(0.5) ? 52 : -52;
  if (Math.abs(p.x - Math.round(p.x / 400) * 400) < 5) return { x: p.x + dx, y: p.y };
  return { x: p.x, y: p.y + dy };
}

export function createGame(seed) {
  nextId = 1;
  const rng = makeRng(seed);
  const city = buildCity(seed);
  const G = {
    seed,
    time: 0,
    screen: 'title',
    city,
    rng,
    player: {
      x: 800,
      y: 1200,
      angle: -Math.PI / 2,
      aimAngle: -Math.PI / 2,
      health: PLAYER.maxHealth,
      money: START_MONEY,
      ammo: PLAYER.magSize,
      reserveAmmo: 48,
      cooldown: 0,
      reloadTimer: 0,
      punchTimer: 0,
      inCar: null,
      hurtFlash: 0,
      speed: 0,
    },
    cars: [],
    peds: [],
    cops: [],
    wanted: 0,
    crimeTimer: 0,
    decayTimer: 0,
    missionIndex: 0,
    mission: null,
    missionStage: 0,
    missionTimer: 0,
    missionHold: 0,
    missionDone: false,
    storyComplete: false,
    completedMissions: [],
    particles: [],
    popups: [],
    shake: 0,
    camera: { x: 800, y: 1200 },
    muted: false,
    banner: null,
    bannerTimer: 0,
    stats: { carsStolen: 0, missionsDone: 0, shotsFired: 0 },
  };

  // Traffic: cars rolling along the avenues and streets.
  for (let i = 0; i < 16; i += 1) {
    const p = randomRoadPoint(rng);
    const vertical = rng.chance(0.5);
    const dir = vertical ? (rng.chance(0.5) ? 1 : 3) : (rng.chance(0.5) ? 0 : 2);
    const angle = [0, Math.PI / 2, Math.PI, -Math.PI / 2][dir];
    const car = makeCar(rng, p.x, p.y, angle, { traffic: true, dir });
    car.speed = car.targetSpeed;
    G.cars.push(car);
  }

  // Parked cars the player can steal, tucked beside the roads.
  const parkedSpots = [
    { x: 856, y: 440 }, { x: 1256, y: 840 }, { x: 1656, y: 1240 }, { x: 2056, y: 1640 },
    { x: 456, y: 1640 }, { x: 2456, y: 840 }, { x: 856, y: 2040 }, { x: 1256, y: 1640 },
    { x: 2056, y: 440 }, { x: 2456, y: 1240 }, { x: 456, y: 840 }, { x: 1656, y: 440 },
  ];
  for (const s of parkedSpots) {
    if (hitsBuilding(city, s.x, s.y, 40)) continue;
    G.cars.push(makeCar(rng, s.x, s.y, rng.chance(0.5) ? 0 : Math.PI / 2, { parked: true }));
  }
  // The gold Comet GT the second mission is about, parked by Palm Park.
  const gold = makeCar(rng, 1660, 1180, Math.PI / 2, { parked: true, gold: true, color: '#d9a521', kind: 'sport' });
  G.cars.push(gold);
  G.goldCarId = gold.id;

  // Pedestrians strolling the sidewalks.
  for (let i = 0; i < 26; i += 1) {
    const p = randomSidewalkPoint(rng);
    if (p.x < 60 || p.x > WORLD.w - 60 || p.y < 60 || p.y > WORLD.h - 60) continue;
    if (hitsBuilding(city, p.x, p.y, 24)) continue;
    if (onRoad(p.x, p.y, 6)) continue;
    G.peds.push(makePed(rng, p.x, p.y));
  }

  return G;
}

export function addParticles(G, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = G.rng.range(0, Math.PI * 2);
    const s = G.rng.range(speed * 0.3, speed);
    G.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: G.rng.range(0.3, 0.8),
      maxLife: 0.8,
      color,
      size: G.rng.range(2, 5),
    });
  }
}

export function addPopup(G, x, y, text, color) {
  G.popups.push({ x, y, text, color: color || '#ffffff', life: 1.2 });
}

export function setBanner(G, title, sub, dur) {
  G.banner = { title, sub: sub || '', timer: dur || 2.6 };
}

export function playerPos(G) {
  if (G.player.inCar) {
    const car = G.cars.find((c) => c.id === G.player.inCar);
    return car ? { x: car.x, y: car.y } : { x: G.player.x, y: G.player.y };
  }
  return { x: G.player.x, y: G.player.y };
}

export function clampToWorld(x, y, margin) {
  return {
    x: clamp(x, margin, WORLD.w - margin),
    y: clamp(y, margin, WORLD.h - margin),
  };
}
