// Wanted level and the police who answer it: foot cops who chase and bust,
// police cars that hunt along the roads and ram.
import { TUNING } from './config.js';
import { randomIntersection, nearestRoadPoint, resolveCircle } from './city.js';
import { makeCar } from './cars.js';
import { addBanner, addFloater, spawnParticles } from './state.js';

export function addCrime(state, level) {
  if (state.mode !== 'playing') return;
  state.wanted = Math.min(5, state.wanted + level);
  state.heatTimer = 0;
  state.decayAccumulator = 0;
}

export function updateWanted(state, dt) {
  state.heatTimer += dt;
  if (state.wanted > 0 && state.heatTimer > TUNING.wantedDecayDelay) {
    state.decayAccumulator = (state.decayAccumulator || 0) + dt;
    if (state.decayAccumulator >= TUNING.wantedDecayStep) {
      state.decayAccumulator = 0;
      state.wanted -= 1;
      if (state.wanted === 0) addFloater(state, state.player.x, state.player.y - 30, 'Heat lost', '#7dff6a');
    }
  }
}

function spawnSpotNear(state, rng, distance) {
  const a = rng.range(0, Math.PI * 2);
  const x = state.player.x + Math.cos(a) * distance;
  const y = state.player.y + Math.sin(a) * distance;
  return { x: Math.max(60, Math.min(3060, x)), y: Math.max(60, Math.min(2220, y)) };
}

export function ensurePolice(state, city, rng, dt) {
  const wanted = state.wanted;
  const wantFoot = wanted >= 1 ? Math.min(wanted, 3) + (wanted >= 4 ? 1 : 0) : 0;
  const wantCars = wanted >= 2 ? Math.min(wanted - 1, 3) : 0;
  const foot = state.cops.filter((c) => !c.down).length;
  const cars = state.cars.filter((c) => c.kind === 'police').length;

  if (foot < wantFoot) {
    const spot = spawnSpotNear(state, rng, 750);
    const road = nearestRoadPoint(spot.x, spot.y);
    state.cops.push({
      x: road.x, y: road.y, angle: 0, speed: TUNING.copFootSpeed,
      down: false, downTimer: 0, busting: false,
    });
  }
  if (cars < wantCars) {
    const spot = spawnSpotNear(state, rng, 900);
    const road = nearestRoadPoint(spot.x, spot.y);
    const car = makeCar('police', road.x, road.y, 0, 2);
    car.color = '#1a1a2e';
    car.speed = TUNING.copCarSpeed;
    car.target = randomIntersection(rng);
    state.cars.push(car);
  }
  // Heat gone: the law stands down.
  if (wanted === 0) {
    state.cops = state.cops.filter((c) => c.down);
    state.cars = state.cars.filter((c) => c.kind !== 'police');
    state.bustMeter = 0;
  }
}

export function updateCops(state, city, dt) {
  const player = state.player;
  for (const cop of state.cops) {
    if (cop.down) {
      cop.downTimer -= dt;
      continue;
    }
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const d = Math.hypot(dx, dy);
    if (player.inCar) {
      // On foot only: cops wait at the kerb when the player drives away.
      if (d > 500) continue;
      cop.angle = Math.atan2(dy, dx);
      continue;
    }
    if (d > 0.01) {
      cop.angle = Math.atan2(dy, dx);
      const step = cop.speed * dt;
      cop.x += Math.cos(cop.angle) * step;
      cop.y += Math.sin(cop.angle) * step;
      const pos = { x: cop.x, y: cop.y };
      resolveCircle(city, pos, 12);
      cop.x = pos.x;
      cop.y = pos.y;
    }
    // Sustained contact busts the player.
    if (d < 30) {
      state.bustMeter += dt;
      if (state.bustMeter >= TUNING.bustTime) {
        state.mode = 'busted';
        addBanner(state, 'BUSTED', 'Vera Voss will not be pleased.');
      }
    } else {
      state.bustMeter = Math.max(0, state.bustMeter - dt * 1.5);
    }
  }
  state.cops = state.cops.filter((c) => !c.down || c.downTimer > 0);
}

export function updatePoliceCars(state, city, dt) {
  const player = state.player;
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const d = Math.hypot(dx, dy);
    // Steer along the roads toward the player: aim at the player's road point.
    const road = nearestRoadPoint(player.x, player.y);
    const tx = d < 120 ? player.x : road.x;
    const ty = d < 120 ? player.y : road.y;
    const want = Math.atan2(ty - car.y, tx - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    car.dirX = Math.cos(car.angle);
    car.dirY = Math.sin(car.angle);
    const speed = d > 400 ? TUNING.copCarSpeed : TUNING.copCarSpeed * 0.85;
    car.x += car.dirX * speed * dt;
    car.y += car.dirY * speed * dt;
    const pos = { x: car.x, y: car.y };
    const before = { x: pos.x, y: pos.y };
    resolveCircle(city, pos, 16);
    if (pos.x !== before.x || pos.y !== before.y) car.angle += Math.PI / 3;
    car.x = pos.x;
    car.y = pos.y;
    // Ram: contact hurts the player (or their car) and shakes the camera.
    if (d < 52) {
      const now = state.time;
      if (now - (car.lastRam || -99) > 0.8) {
        car.lastRam = now;
        player.health -= 9;
        player.lastHurt = now;
        state.shake = Math.max(state.shake, 7);
        spawnParticles(state, player.x, player.y, 10, '#ff5e6a', 150);
        addFloater(state, player.x, player.y - 26, '-9', '#ff8a8a');
        if (player.health <= 0) {
          state.mode = 'wasted';
          addBanner(state, 'WASTED', 'The Neon Bay PD sends its regards.');
        }
      }
    }
  }
}

// A shot cop goes down: heat jumps, the player earns a stat.
export function copShotDown(state, cop) {
  if (cop.down) return;
  cop.down = true;
  cop.downTimer = 4;
  state.stats.copsDown++;
  addCrime(state, 2);
  spawnParticles(state, cop.x, cop.y, 14, '#3ae0ff', 160);
  addFloater(state, cop.x, cop.y - 24, 'Cop down! +2 stars', '#ff8a8a');
}
