// Game state: creation, save/load and the small shared helpers
// (banners, floating texts, particles) every module uses.
import { TUNING } from './config.js';

export const SAVE_KEY = 'neon-bay-save-v1';

export function createGame(seed) {
  return {
    seed,
    time: 0,
    mode: 'title', // title | playing | paused | wasted | busted | story
    money: 120,
    missionsDone: 0,
    mission: null, // { id, stage, timer, hold, target }
    missionBanner: 0,
    player: {
      x: 700, y: 420, angle: -Math.PI / 2, health: TUNING.playerHealth,
      ammo: TUNING.pistolAmmo, reloading: 0, fireCooldown: 0, punchCooldown: 0,
      inCar: null, // car id or null
      moving: false, lastHurt: -99, calmTimer: 0,
    },
    cars: [], // traffic + parked + police cars
    peds: [],
    cops: [], // foot cops
    particles: [],
    floaters: [], // {x, y, text, color, t, life}
    tracers: [], // {x1,y1,x2,y2,t}
    wanted: 0,
    heatTimer: 0, // seconds since last crime
    bustMeter: 0,
    camera: { x: 700, y: 420 },
    shake: 0,
    banner: null, // {text, sub, t, life}
    saveTimer: 0,
    stats: { shots: 0, steals: 0, pedsHit: 0, copsDown: 0 },
    storyDone: false,
    titleChoice: 0, // 0 = new game, 1 = continue (when a save exists)
    hasSave: false,
    muted: false,
    shotMode: null,
    shotReady: false,
  };
}

export function addBanner(state, text, sub) {
  state.banner = { text, sub: sub || '', t: 0, life: 3.2 };
}

export function addFloater(state, x, y, text, color) {
  state.floaters.push({ x, y, text, color: color || '#ffffff', t: 0, life: 1.4 });
}

export function spawnParticles(state, x, y, count, color, speed) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (speed || 120) * (0.4 + Math.random() * 0.8);
    state.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      t: 0, life: 0.5 + Math.random() * 0.5, color, size: 2 + Math.random() * 3,
    });
  }
}

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      missionsDone: state.missionsDone,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    state.hasSave = true;
  } catch {
    // storage unavailable (private mode, Node test) — the game still runs
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionsDone !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
