// NEON BAY — cars: traffic rolling on the road grid, parked cars waiting to
// be stolen, and the arcade driving model for the player's car.
import { AVENUES, CAR, STREETS, WORLD } from './config.js';
import { collideBuildings, nearestIntersection } from './city.js';
import { angleDiff, clamp, dist, makeRng } from './random.js';
import { addParticles, makeCar, makePed } from './state.js';

const DIRS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

// The point a road-bound car should steer toward to reach a target while
// staying on the avenues and streets: along its current road first, then
// onto the crossing road, and to the nearest intersection when off-road.
export function gridSteerTarget(x, y, tx, ty) {
  const nearAve = AVENUES.find((ax) => Math.abs(x - ax) < 38);
  const nearSt = STREETS.find((sy) => Math.abs(y - sy) < 38);
  if (nearAve !== undefined) {
    if (Math.abs(y - ty) < 40) return { x: tx, y: ty };
    return { x: nearAve, y: ty };
  }
  if (nearSt !== undefined) {
    if (Math.abs(x - tx) < 40) return { x: tx, y: ty };
    return { x: tx, y: nearSt };
  }
  return nearestIntersection(x, y);
}

// At an intersection, the roads a car may turn onto (it never U-turns).
function nextDirAt(car, rng) {
  const options = [0, 1, 2, 3].filter((d) => d !== (car.dir + 2) % 4);
  // Prefer the direction that keeps the car inside the city.
  const ok = options.filter((d) => {
    const nx = car.x + DIRS[d].x * 200;
    const ny = car.y + DIRS[d].y * 200;
    return nx > 100 && nx < WORLD.w - 100 && ny > 100 && ny < WORLD.h - 140;
  });
  const pool = ok.length ? ok : options;
  return rng.pick(pool);
}

export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (!car.traffic) continue;
    // Ease toward its cruising speed.
    car.speed += (car.targetSpeed - car.speed) * Math.min(1, dt * 1.5);
    const d = DIRS[car.dir];
    car.x += d.x * car.speed * dt;
    car.y += d.y * car.speed * dt;
    // At an intersection, maybe turn onto the crossing road.
    const nearX = AVENUES.some((ax) => Math.abs(car.x - ax) < 14);
    const nearY = STREETS.some((sy) => Math.abs(car.y - sy) < 14);
    if (nearX && nearY && G.rng.chance(dt * 1.4)) {
      car.dir = nextDirAt(car, G.rng);
      car.angle = [0, Math.PI / 2, Math.PI, -Math.PI / 2][car.dir];
      // Snap onto the road centre so turns stay clean.
      let bestX = AVENUES[0];
      let bestY = STREETS[0];
      for (const ax of AVENUES) if (Math.abs(ax - car.x) < Math.abs(bestX - car.x)) bestX = ax;
      for (const sy of STREETS) if (Math.abs(sy - car.y) < Math.abs(bestY - sy)) bestY = sy;
      if (car.dir % 2 === 0) car.y = bestY;
      else car.x = bestX;
    }
    // Wrap around the far edge so the streets never empty out.
    if (car.x < 60) { car.x = WORLD.w - 80; }
    if (car.x > WORLD.w - 60) { car.x = 80; }
    if (car.y < 60) { car.y = WORLD.h - 160; }
    if (car.y > WORLD.h - 140) { car.y = 80; }
  }
  // Keep traffic cars from piling onto each other.
  for (let i = 0; i < G.cars.length; i += 1) {
    const a = G.cars[i];
    if (!a.traffic) continue;
    for (let j = i + 1; j < G.cars.length; j += 1) {
      const b = G.cars[j];
      if (!b.traffic) continue;
      const d = dist(a.x, a.y, b.x, b.y);
      if (d < 46 && d > 0.01) {
        const push = (46 - d) / 2;
        const nx = (a.x - b.x) / d;
        const ny = (a.y - b.y) / d;
        a.x += nx * push;
        a.y += ny * push;
        b.x -= nx * push;
        b.y -= ny * push;
        a.speed = Math.min(a.speed, b.speed);
        b.speed = Math.min(a.speed, b.speed);
      }
    }
  }
}

// The nearest car the player could steal, on foot, within reach.
export function nearestStealableCar(G, x, y) {
  let best = null;
  let bestD = 78;
  for (const car of G.cars) {
    if (car.police) continue;
    if (G.player.inCar === car.id) continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

// Steal a car: a traffic car's driver bails out and runs; a parked car is free.
export function stealCar(G, car) {
  const player = G.player;
  if (car.traffic) {
    car.traffic = false;
    car.parked = false;
    if (car.driver) {
      const ped = makePed(G.rng, car.x + 40, car.y + 30);
      ped.flee = 3;
      ped.shirt = car.driver.shirt;
      ped.skin = car.driver.skin;
      G.peds.push(ped);
    }
    car.driver = null;
  }
  car.parked = false;
  player.inCar = car.id;
  player.x = car.x;
  player.y = car.y;
  G.stats.carsStolen += 1;
  return car;
}

// Drive the player's car with arcade physics: gas, brake, steering, handbrake.
export function drivePlayerCar(G, car, input, dt) {
  const axis = input.axis();
  const forward = -axis.y; // W is gas
  const steer = axis.x;
  const handbrake = input.down(' ');
  if (forward > 0) car.speed += CAR.accel * dt;
  else if (forward < 0) {
    if (car.speed > 20) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.6 * dt;
  } else {
    car.speed -= car.speed * 0.9 * dt;
  }
  if (handbrake) car.speed -= car.speed * 3.2 * dt;
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  const speedRatio = Math.abs(car.speed) / CAR.maxSpeed;
  // Sharper steering at low speed, steadier at high speed.
  const turn = steer * CAR.turnRate * (1.15 - 0.55 * speedRatio) * (car.speed >= 0 ? 1 : -1);
  car.angle += turn * dt * (handbrake ? 1.5 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const fixed = collideBuildings(G.city, car.x, car.y, 26);
  if (fixed.x !== car.x || fixed.y !== car.y) {
    if (Math.abs(car.speed) > 180) {
      addParticles(G, car.x, car.y, '#e8b13d', 8, 120);
    }
    car.speed *= 0.4;
    car.x = fixed.x;
    car.y = fixed.y;
  }
  car.x = clamp(car.x, 40, WORLD.w - 40);
  car.y = clamp(car.y, 40, WORLD.h - 40);
  car.brakeLight = forward < 0 || handbrake;
  return speedRatio;
}

// Bump the player's car away from other cars (a soft shove, no damage model).
export function collidePlayerCar(G, car) {
  for (const other of G.cars) {
    if (other.id === car.id) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < 56 && d > 0.01) {
      const push = (56 - d) / 2;
      const nx = (car.x - other.x) / d;
      const ny = (car.y - other.y) / d;
      car.x += nx * push;
      car.y += ny * push;
      if (!other.traffic && !other.police) {
        other.x -= nx * push;
        other.y -= ny * push;
      } else if (other.traffic) {
        other.speed *= 0.5;
      }
      car.speed *= 0.85;
    }
  }
}
