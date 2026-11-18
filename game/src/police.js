// NEON BAY — the law: a wanted level from 0 to 5 stars, foot cops who chase
// the player down and police cars that hunt the player's car. Committing
// crimes raises the heat; laying low lets it cool off.
import { CAR, POLICE, WORLD } from './config.js';
import { collideBuildings, nearestIntersection } from './city.js';
import { gridSteerTarget } from './cars.js';
import { angleDiff, clamp, dist } from './random.js';
import { addParticles, makeCar, makeCop, playerPos } from './state.js';

export function commitCrime(G, stars) {
  const before = G.wanted;
  G.wanted = clamp(G.wanted + stars, 0, 5);
  G.crimeTimer = 0;
  G.decayTimer = 0;
  if (G.wanted > before && G.wanted >= 2) {
    spawnPoliceCars(G, G.wanted - before);
  }
}

function spawnSpot(G) {
  const pp = playerPos(G);
  const a = G.rng.range(0, Math.PI * 2);
  const r = G.rng.range(560, 800);
  const p = nearestIntersection(pp.x + Math.cos(a) * r, pp.y + Math.sin(a) * r);
  return {
    x: clamp(p.x, 90, WORLD.w - 90),
    y: clamp(p.y, 90, WORLD.h - 240),
  };
}

export function spawnFootCops(G, count) {
  for (let i = 0; i < count; i += 1) {
    const s = spawnSpot(G);
    G.cops.push(makeCop(G.rng, s.x, s.y, false));
  }
}

export function spawnPoliceCars(G, count) {
  for (let i = 0; i < count; i += 1) {
    const s = spawnSpot(G);
    const car = makeCar(G.rng, s.x, s.y, 0, { police: true, color: '#2b4a8a', kind: 'police' });
    car.speed = CAR.policeSpeed * 0.7;
    G.cars.push(car);
    const cop = makeCop(G.rng, s.x, s.y, true);
    cop.car = car.id;
    G.cops.push(cop);
  }
}

export function updatePolice(G, dt, sfx) {
  const pp = playerPos(G);
  const inCar = !!G.player.inCar;

  // Wanted level cools off when the player stays clean and out of sight.
  if (G.wanted > 0) {
    G.crimeTimer += dt;
    if (G.crimeTimer > POLICE.wantedDecayDelay) {
      G.decayTimer += dt;
      if (G.decayTimer > POLICE.wantedDecayStep) {
        G.decayTimer = 0;
        G.wanted -= 1;
        if (G.wanted === 0) {
          G.cops = [];
          for (const car of G.cars) {
            if (car.police) {
              car.police = false;
              car.traffic = true;
              car.targetSpeed = CAR.trafficSpeed;
            }
          }
        }
      }
    }
  }

  // Keep enough cops on the street for the current heat.
  const wantedFoot = G.wanted >= 1 ? Math.min(2 + G.wanted, 6) : 0;
  const footCops = G.cops.filter((c) => !c.inCar).length;
  if (footCops < wantedFoot && G.rng.chance(dt * 0.8)) spawnFootCops(G, 1);
  const wantedCars = G.wanted >= 2 ? Math.min(G.wanted - 1, 3) : 0;
  const policeCars = G.cars.filter((c) => c.police).length;
  if (policeCars < wantedCars && G.rng.chance(dt * 0.6)) spawnPoliceCars(G, 1);

  // Foot cops run at the player; standing next to one for too long gets you busted.
  for (const cop of G.cops) {
    if (cop.inCar) continue;
    // A cop who was shot or punched stays down for a while.
    if (cop.down > 0) {
      cop.down -= dt;
      continue;
    }
    const d = dist(cop.x, cop.y, pp.x, pp.y);
    const a = Math.atan2(pp.y - cop.y, pp.x - cop.x);
    cop.angle = a;
    const speed = POLICE.footSpeed * (1 + G.wanted * 0.06);
    cop.x += Math.cos(a) * speed * dt;
    cop.y += Math.sin(a) * speed * dt;
    const fixed = collideBuildings(G.city, cop.x, cop.y, 12);
    cop.x = fixed.x;
    cop.y = fixed.y;
    if (!inCar && d < POLICE.bustRadius) {
      cop.bustTimer += dt;
      if (cop.bustTimer > POLICE.bustTime) {
        G.screen = 'busted';
        sfx.busted();
      }
    } else {
      cop.bustTimer = Math.max(0, cop.bustTimer - dt * 2);
    }
    // A cop on foot who touches the player's slow car gets knocked aside.
    if (inCar) {
      const car = G.cars.find((c) => c.id === G.player.inCar);
      if (car && dist(cop.x, cop.y, car.x, car.y) < 30) {
        cop.x += (cop.x - car.x) * 0.8;
        cop.y += (cop.y - car.y) * 0.8;
        addParticles(G, cop.x, cop.y, '#2b4a8a', 6, 100);
        G.player.health = Math.max(0, G.player.health - 0);
      }
    }
  }

  // Police cars hunt the player across the road grid, one intersection at a time.
  for (const car of G.cars) {
    if (!car.police) continue;
    const d = dist(car.x, car.y, pp.x, pp.y);
    // Far away: head for the intersection nearest the player, staying on the
    // roads. Close in: ram straight at the player.
    const hunt = d > 260 ? nearestIntersection(pp.x, pp.y) : pp;
    const steer = gridSteerTarget(car.x, car.y, hunt.x, hunt.y);
    const wantAngle = Math.atan2(steer.y - car.y, steer.x - car.x);
    const diff = angleDiff(car.angle, wantAngle);
    car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    const targetSpeed = d > 700 ? CAR.policeSpeed : CAR.policeSpeed * 0.75;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const fixed = collideBuildings(G.city, car.x, car.y, 24);
    if (fixed.x !== car.x || fixed.y !== car.y) {
      // Stuck on a building: back up and swing around it.
      car.speed *= -0.4;
      car.angle += 0.9;
      car.x = fixed.x;
      car.y = fixed.y;
    }
    car.x = clamp(car.x, 40, WORLD.w - 40);
    car.y = clamp(car.y, 40, WORLD.h - 40);
    // Ramming the player's car shakes the screen and slows them both.
    if (inCar) {
      const pc = G.cars.find((c) => c.id === G.player.inCar);
      if (pc && dist(car.x, car.y, pc.x, pc.y) < 54) {
        const push = 30;
        const nx = (pc.x - car.x) / Math.max(1, d);
        const ny = (pc.y - car.y) / Math.max(1, d);
        pc.x += nx * push;
        pc.y += ny * push;
        pc.speed *= 0.7;
        car.speed *= 0.7;
        G.shake = Math.max(G.shake, 7);
        addParticles(G, pc.x, pc.y, '#e8b13d', 5, 120);
      }
    }
  }

  // Drop cops that fell too far behind the action.
  G.cops = G.cops.filter((c) => dist(c.x, c.y, pp.x, pp.y) < 1400);
  G.cars = G.cars.filter((c) => !c.police || dist(c.x, c.y, pp.x, pp.y) < 1600);
}
