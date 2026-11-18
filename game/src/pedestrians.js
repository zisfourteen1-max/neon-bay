// Pedestrians: sidewalk walkers who stroll, flee gunfire and fast cars,
// and get knocked down (never killed) when a car hits them.
import { AVENUES, STREETS, ROAD_W, TUNING } from './config.js';
import { resolveCircle, isWater } from './city.js';
import { spawnParticles, addFloater } from './state.js';

const SHIRTS = ['#ff5e6a', '#4aa3ff', '#ffd23e', '#7dff6a', '#ff8a3a', '#c9a0ff', '#ffffff', '#3ae0ff'];

export function spawnPeds(state, city, rng, count) {
  for (let i = 0; i < count; i++) {
    const horizontal = rng.chance(0.5);
    const road = horizontal ? rng.pick(STREETS) : rng.pick(AVENUES);
    const along = horizontal ? rng.range(120, 3000) : rng.range(120, 2100);
    const side = rng.chance(0.5) ? 1 : -1;
    const x = horizontal ? along : road + side * (ROAD_W / 2 + 14);
    const y = horizontal ? road + side * (ROAD_W / 2 + 14) : along;
    if (isWater(x, y)) continue;
    state.peds.push({
      x, y,
      angle: horizontal ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2),
      speed: TUNING.pedWalk * rng.range(0.7, 1.3),
      mode: 'walk', // walk | flee | down
      shirt: rng.pick(SHIRTS),
      fleeTimer: 0,
      downTimer: 0,
      turnTimer: rng.range(2, 8),
    });
  }
}

export function fleeFrom(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.mode === 'down') continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.mode = 'flee';
      ped.fleeTimer = 3 + Math.random() * 2;
      ped.angle = Math.atan2(ped.y - y, ped.x - x);
    }
  }
}

export function updatePeds(state, city, dt) {
  for (const ped of state.peds) {
    if (ped.mode === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.mode = 'flee';
        ped.fleeTimer = 4;
        ped.angle = Math.random() * Math.PI * 2;
      }
      continue;
    }
    const speed = ped.mode === 'flee' ? TUNING.pedFlee : ped.speed;
    ped.x += Math.cos(ped.angle) * speed * dt;
    ped.y += Math.sin(ped.angle) * speed * dt;
    const pos = { x: ped.x, y: ped.y };
    if (resolveCircle(city, pos, 10)) {
      ped.x = pos.x;
      ped.y = pos.y;
      ped.angle += Math.PI / 2;
    }
    if (ped.mode === 'flee') {
      ped.fleeTimer -= dt;
      if (ped.fleeTimer <= 0) ped.mode = 'walk';
    } else {
      ped.turnTimer -= dt;
      if (ped.turnTimer <= 0) {
        ped.turnTimer = 3 + Math.random() * 7;
        // Wander: mostly keep going, sometimes turn at a corner.
        if (Math.random() < 0.4) ped.angle += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
      }
    }
    // Stay inside the walkable city.
    if (ped.x < 30 || ped.x > 3090 || ped.y < 30 || ped.y > 2240) {
      ped.angle += Math.PI;
      ped.x = Math.max(30, Math.min(3090, ped.x));
      ped.y = Math.max(30, Math.min(2240, ped.y));
    }
  }
}

// A car ran a pedestrian over: they go down, the player earns heat.
export function knockPedDown(state, ped) {
  if (ped.mode === 'down') return;
  ped.mode = 'down';
  ped.downTimer = 6;
  state.stats.pedsHit++;
  spawnParticles(state, ped.x, ped.y, 10, '#ff5e6a', 120);
  addFloater(state, ped.x, ped.y - 20, 'Ouch!', '#ff8a8a');
}
