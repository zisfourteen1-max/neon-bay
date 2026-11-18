// Kit Marlowe on foot: walking, aiming, shooting, punching,
// and stealing cars with E.
import { TUNING } from './config.js';
import { resolveCircle, pointHitsBuilding, isWater } from './city.js';
import { nearestCar } from './cars.js';
import { fleeFrom, knockPedDown } from './pedestrians.js';
import { addCrime, copShotDown } from './police.js';
import { addFloater, spawnParticles } from './state.js';

function crimeWithCooldown(state, level, cooldownSeconds) {
  if ((state.crimeCooldown || 0) > 0) return;
  addCrime(state, level);
  state.crimeCooldown = cooldownSeconds;
}

// Hitscan shot: walk the ray in steps and take the first thing it meets.
function raycast(state, city, ox, oy, angle, maxDist) {
  const step = 8;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let d = step; d <= maxDist; d += step) {
    const x = ox + dx * d;
    const y = oy + dy * d;
    if (isWater(x, y)) return { x, y, dist: d, kind: 'water' };
    if (pointHitsBuilding(city, x, y)) return { x, y, dist: d, kind: 'wall' };
    for (const car of state.cars) {
      if (Math.hypot(car.x - x, car.y - y) < 22) return { x, y, dist: d, kind: 'car', car };
    }
    for (const ped of state.peds) {
      if (ped.mode !== 'down' && Math.hypot(ped.x - x, ped.y - y) < 13) return { x, y, dist: d, kind: 'ped', ped };
    }
    for (const cop of state.cops) {
      if (!cop.down && Math.hypot(cop.x - x, cop.y - y) < 14) return { x, y, dist: d, kind: 'cop', cop };
    }
  }
  return { x: ox + dx * maxDist, y: oy + dy * maxDist, dist: maxDist, kind: 'none' };
}

function shoot(state, city, audio) {
  const p = state.player;
  if (p.ammo <= 0) {
    audio.pickup(true); // dry click
    p.fireCooldown = 0.3;
    return;
  }
  p.ammo -= 1;
  p.fireCooldown = TUNING.pistolFireDelay;
  state.stats.shots++;
  audio.shot();
  state.shake = Math.max(state.shake, 2);
  const hit = raycast(state, city, p.x, p.y, p.angle, 520);
  state.tracers.push({ x1: p.x, y1: p.y, x2: hit.x, y2: hit.y, t: 0 });
  spawnParticles(state, hit.x, hit.y, 6, '#ffe14a', 130);
  fleeFrom(state, p.x, p.y, 340);
  crimeWithCooldown(state, 1, 2);
  if (hit.kind === 'ped') {
    knockPedDown(state, hit.ped);
    crimeWithCooldown(state, 1, 0); // a downed pedestrian is a second crime
  } else if (hit.kind === 'cop') {
    copShotDown(state, hit.cop);
  } else if (hit.kind === 'car') {
    spawnParticles(state, hit.x, hit.y, 8, '#ffd23e', 160);
  }
}

function punch(state, audio) {
  const p = state.player;
  p.punchCooldown = TUNING.punchDelay;
  audio.punch();
  const px = p.x + Math.cos(p.angle) * 30;
  const py = p.y + Math.sin(p.angle) * 30;
  for (const ped of state.peds) {
    if (ped.mode !== 'down' && Math.hypot(ped.x - px, ped.y - py) < TUNING.punchRange) {
      knockPedDown(state, ped);
      crimeWithCooldown(state, 1, 2);
      return;
    }
  }
  for (const cop of state.cops) {
    if (!cop.down && Math.hypot(cop.x - px, cop.y - py) < TUNING.punchRange) {
      copShotDown(state, cop);
      return;
    }
  }
}

export function updatePlayer(state, city, input, audio, dt) {
  const p = state.player;
  state.crimeCooldown = Math.max(0, (state.crimeCooldown || 0) - dt);
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) {
      p.ammo = TUNING.pistolAmmo;
      addFloater(state, p.x, p.y - 26, 'Reloaded', '#ffffff');
    }
  }

  // E: get in / out of the nearest car.
  if (input.pressed('KeyE')) {
    if (p.inCar) {
      const car = state.cars.find((c) => c.id === p.inCar);
      p.inCar = null;
      if (car) {
        const side = { x: car.x - Math.sin(car.angle) * 40, y: car.y + Math.cos(car.angle) * 40 };
        const pos = { x: side.x, y: side.y };
        resolveCircle(city, pos, TUNING.playerRadius);
        p.x = pos.x;
        p.y = pos.y;
        car.speed = 0;
        if (car.kind === 'traffic') { car.kind = 'parked'; car.hasDriver = false; }
      }
      audio.pickup(false);
    } else {
      const car = nearestCar(state, p.x, p.y, 62);
      if (car) {
        if (car.kind === 'traffic' && car.hasDriver) {
          // The driver bails out and runs.
          car.hasDriver = false;
          state.peds.push({
            x: car.x - Math.sin(car.angle) * 30, y: car.y + Math.cos(car.angle) * 30,
            angle: Math.atan2(p.y - car.y, p.x - car.x), speed: 90,
            mode: 'flee', shirt: '#ffffff', fleeTimer: 5, downTimer: 0, turnTimer: 0,
          });
        }
        p.inCar = car.id;
        p.x = car.x;
        p.y = car.y;
        state.stats.steals++;
        crimeWithCooldown(state, 1, 0);
        addFloater(state, car.x, car.y - 30, car.gold ? 'Comet GT — go!' : `${car.model} stolen`, '#ffe14a');
        audio.pickup(false);
      }
    }
  }

  if (p.inCar) return; // driving is handled by cars.updatePlayerCar

  // Aim at the mouse.
  const mx = input.mouseWorldX - p.x;
  const my = input.mouseWorldY - p.y;
  if (mx * mx + my * my > 4) p.angle = Math.atan2(my, mx);

  // Move.
  const ax = input.axis();
  const running = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const speed = running ? TUNING.playerRun : TUNING.playerWalk;
  p.moving = ax.x !== 0 || ax.y !== 0;
  const len = Math.hypot(ax.x, ax.y) || 1;
  const nx = p.x + (ax.x / len) * speed * dt;
  const ny = p.y + (ax.y / len) * speed * dt;
  const pos = { x: nx, y: ny };
  resolveCircle(city, pos, TUNING.playerRadius);
  p.x = pos.x;
  p.y = pos.y;

  // Combat.
  if (input.mouseDown && p.fireCooldown <= 0 && p.reloading <= 0) shoot(state, city, audio);
  if (input.pressed('Space') && p.punchCooldown <= 0) punch(state, audio);
  if (input.pressed('KeyR') && p.reloading <= 0 && p.ammo < TUNING.pistolAmmo) {
    p.reloading = TUNING.pistolReload;
    audio.pickup(false);
  }

  // Slow health regen while the heat is off.
  if (state.wanted === 0 && state.time - p.lastHurt > 10 && p.health < TUNING.playerHealth) {
    p.health = Math.min(TUNING.playerHealth, p.health + 4 * dt);
  }
}
