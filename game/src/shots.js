// NEON BAY — the four screenshot scenes. Each one plays the real game forward
// from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what a short game really looks like and the same
// seed always gives the same frame. The frame then repaints every animation
// frame so a screenshot is never blank.
import { drivePlayerCar, gridSteerTarget, stealCar, updateTraffic } from './cars.js';
import { updatePeds } from './pedestrians.js';
import { spawnPoliceCars, updatePolice } from './police.js';
import { startMission } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { angleDiff, clamp } from './random.js';

const STEP = 1 / 60;
const STUB_SFX = { busted() {}, missionStart() {}, missionComplete() {}, pickup() {} };

// Steer a car toward a target point, following the road grid like a player would.
function driveToward(G, car, tx, ty, dt) {
  const steer = gridSteerTarget(car.x, car.y, tx, ty);
  const want = Math.atan2(steer.y - car.y, steer.x - car.x);
  const diff = angleDiff(car.angle, want);
  const fakeInput = {
    axis: () => ({ x: clamp(diff * 2, -1, 1), y: -1 }),
    down: () => false,
    hit: () => false,
  };
  drivePlayerCar(G, car, fakeInput, dt);
}

function stepWorld(G, dt) {
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt, STUB_SFX);
  for (const pt of G.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
  }
  G.particles = G.particles.filter((pt) => pt.life > 0);
}

// Put the player in the parked car nearest to a point.
function putPlayerInCar(G, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const car of G.cars) {
    if (car.police || car.traffic) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return null;
  stealCar(G, best);
  best.speed = 0;
  return best;
}

/**
 * Set `G` to the named scene (menu, drive, chase or mission; anything else is
 * menu) and return the screen to draw over it.
 */
export function stageShot(name, G) {
  if (name === 'drive') {
    G.screen = SCREEN_PLAY;
    startMission(G, 0, STUB_SFX);
    const car = putPlayerInCar(G, 800, 1200);
    for (let i = 0; i < 8 / STEP; i += 1) {
      G.time += STEP;
      if (car) driveToward(G, car, 800, 2000, STEP);
      stepWorld(G, STEP);
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    G.screen = SCREEN_PLAY;
    startMission(G, 0, STUB_SFX);
    G.wanted = 3;
    const car = putPlayerInCar(G, 1200, 1200);
    spawnPoliceCars(G, 2);
    for (let i = 0; i < 7 / STEP; i += 1) {
      G.time += STEP;
      if (car) driveToward(G, car, 1200, 300, STEP);
      stepWorld(G, STEP);
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    G.screen = SCREEN_PLAY;
    startMission(G, 0, STUB_SFX);
    const car = putPlayerInCar(G, 2400, 1600);
    for (let i = 0; i < 9 / STEP; i += 1) {
      G.time += STEP;
      if (car) driveToward(G, car, 2900, 1780, STEP);
      stepWorld(G, STEP);
    }
    return { screen: SCREEN_PLAY };
  }
  // Menu: a living city behind the title screen.
  G.screen = SCREEN_TITLE;
  G.player.x = 1400;
  G.player.y = 1000;
  for (let i = 0; i < 6 / STEP; i += 1) {
    G.time += STEP;
    stepWorld(G, STEP);
  }
  return { screen: SCREEN_TITLE };
}

export function shotScreens() {
  return ['menu', 'drive', 'chase', 'mission'];
}
