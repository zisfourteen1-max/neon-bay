// Cars: traffic that drives the road grid, parked cars to steal,
// and the arcade physics of the car the player drives.
import { AVENUES, STREETS, ROAD_W, TUNING, CAR_MODELS, WORLD_W, WORLD_H } from './config.js';
import { randomIntersection, parkingSpot, resolveCircle, nearestRoadPoint } from './city.js';
import { addFloater, spawnParticles } from './state.js';

let nextCarId = 1;

export function makeCar(kind, x, y, angle, modelIndex) {
  const model = CAR_MODELS[modelIndex % CAR_MODELS.length];
  return {
    id: nextCarId++,
    kind, // traffic | parked | police | gold
    model: model.name,
    color: model.color,
    gold: !!model.gold,
    x, y, angle,
    speed: 0,
    dirX: Math.cos(angle),
    dirY: Math.sin(angle),
    target: null, // traffic: next intersection
    hasDriver: kind === 'traffic',
    wrecked: false,
    honk: 0,
  };
}

export function spawnTraffic(state, city, rng, count) {
  for (let i = 0; i < count; i++) {
    const node = randomIntersection(rng);
    const horizontal = rng.chance(0.5);
    const dir = rng.chance(0.5) ? 1 : -1;
    const angle = horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar('traffic', node.x, node.y, angle, rng.int(0, CAR_MODELS.length - 1));
    car.speed = TUNING.trafficSpeed * rng.range(0.85, 1.15);
    car.target = nextTarget(node, horizontal, dir, rng);
    state.cars.push(car);
  }
}

function lineIndex(line, value) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < line.length; i++) {
    const d = Math.abs(line[i] - value);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// Next intersection for a car travelling along a road: mostly straight on,
// sometimes a turn at the nearest crossing road. Works from any road point.
function nextTarget(node, horizontal, dir, rng) {
  if (horizontal) {
    const streetIdx = lineIndex(STREETS, node.y);
    const aveIdx = lineIndex(AVENUES, node.x);
    const atEnd = (dir > 0 && aveIdx >= AVENUES.length - 1) || (dir < 0 && aveIdx <= 0);
    if (!atEnd && rng.chance(0.6)) {
      return { x: AVENUES[aveIdx + dir], y: STREETS[streetIdx] };
    }
    const options = [];
    if (streetIdx > 0) options.push(streetIdx - 1);
    if (streetIdx < STREETS.length - 1) options.push(streetIdx + 1);
    const pick = options[Math.floor(rng.next() * options.length)];
    return { x: AVENUES[aveIdx], y: STREETS[pick] };
  }
  const aveIdx = lineIndex(AVENUES, node.x);
  const streetIdx = lineIndex(STREETS, node.y);
  const atEnd = (dir > 0 && streetIdx >= STREETS.length - 1) || (dir < 0 && streetIdx <= 0);
  if (!atEnd && rng.chance(0.6)) {
    return { x: AVENUES[aveIdx], y: STREETS[streetIdx + dir] };
  }
  const options = [];
  if (aveIdx > 0) options.push(aveIdx - 1);
  if (aveIdx < AVENUES.length - 1) options.push(aveIdx + 1);
  const pick = options[Math.floor(rng.next() * options.length)];
  return { x: AVENUES[pick], y: STREETS[streetIdx] };
}

export function spawnParked(state, city, rng, count) {
  for (let i = 0; i < count; i++) {
    const spot = parkingSpot(city, rng);
    const car = makeCar('parked', spot.x, spot.y, spot.angle, rng.int(0, CAR_MODELS.length - 1));
    state.cars.push(car);
  }
}

// The gold Comet GT for the Hot Wheels mission, parked at a fixed curb.
export function spawnGoldCar(state, city, rng) {
  const spot = parkingSpot(city, rng);
  const car = makeCar('gold', spot.x, spot.y, spot.angle, 0);
  state.cars.push(car);
  return car;
}

export function nearestCar(state, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.wrecked) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function carAt(state, x, y) {
  for (const car of state.cars) {
    if (Math.hypot(car.x - x, car.y - y) < 34) return car;
  }
  return null;
}

function carPoints(car) {
  const fx = Math.cos(car.angle) * 15;
  const fy = Math.sin(car.angle) * 15;
  return [
    { x: car.x + fx, y: car.y + fy },
    { x: car.x - fx, y: car.y - fy },
  ];
}

export function updateTraffic(state, city, rng, dt) {
  for (const car of state.cars) {
    if (car.kind !== 'traffic' || car.wrecked) continue;
    if (!car.target) {
      // Shoved off its route by the player: snap back onto the nearest road
      // centreline and rejoin the grid from there.
      const road = nearestRoadPoint(car.x, car.y);
      car.x = road.x;
      car.y = road.y;
      const horizontal = road.axis === 'h';
      const dir = horizontal ? (Math.sign(car.dirX) || 1) : (Math.sign(car.dirY) || 1);
      car.target = nextTarget({ x: car.x, y: car.y }, horizontal, dir, rng);
      const ndx = car.target.x - car.x;
      const ndy = car.target.y - car.y;
      car.angle = Math.atan2(ndy, ndx);
      car.dirX = Math.cos(car.angle);
      car.dirY = Math.sin(car.angle);
      continue;
    }
    const dx = car.target.x - car.x;
    const dy = car.target.y - car.y;
    const dist = Math.hypot(dx, dy);
    const step = car.speed * dt;
    if (dist <= Math.max(step, 10)) {
      car.x = car.target.x;
      car.y = car.target.y;
      const horizontal = Math.abs(dy) < 1;
      const dir = horizontal ? Math.sign(dx) || 1 : Math.sign(dy) || 1;
      car.target = nextTarget({ x: car.x, y: car.y }, horizontal, dir, rng);
      const ndx = car.target.x - car.x;
      const ndy = car.target.y - car.y;
      car.angle = Math.atan2(ndy, ndx);
      car.dirX = Math.cos(car.angle);
      car.dirY = Math.sin(car.angle);
      continue;
    }
    // Slow down if another car is close ahead.
    let slow = false;
    for (const other of state.cars) {
      if (other === car || other.wrecked) continue;
      const ox = other.x - car.x;
      const oy = other.y - car.y;
      const ahead = ox * car.dirX + oy * car.dirY;
      const side = Math.abs(ox * -car.dirY + oy * car.dirX);
      if (ahead > 0 && ahead < 70 && side < 26) { slow = true; break; }
    }
    const v = slow ? car.speed * 0.25 : car.speed;
    car.x += car.dirX * v * dt;
    car.y += car.dirY * v * dt;
  }
}

// Arcade driving for the player's car. input: {up, down, left, right, handbrake}
export function updatePlayerCar(state, city, input, dt) {
  const car = state.cars.find((c) => c.id === state.player.inCar);
  if (!car) { state.player.inCar = null; return; }
  const maxSpeed = TUNING.carMaxSpeed * (CAR_MODELS.find((m) => m.name === car.model)?.speed || 1);
  if (input.up) car.speed += TUNING.carAccel * dt;
  if (input.down) {
    car.speed -= (car.speed > 30 ? TUNING.carBrake : TUNING.carAccel * 0.6) * dt;
  }
  if (!input.up && !input.down) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 220 * dt);
  car.speed = Math.max(-TUNING.carReverseMax, Math.min(maxSpeed, car.speed));
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const grip = input.handbrake ? 1.9 : 1;
  const turnRate = TUNING.carTurn * grip * Math.min(1, Math.abs(car.speed) / 140) * Math.sign(car.speed || 1);
  car.angle += steer * turnRate * dt;
  if (input.handbrake) car.speed *= Math.max(0, 1 - 1.6 * dt);
  car.dirX = Math.cos(car.angle);
  car.dirY = Math.sin(car.angle);

  const oldX = car.x;
  const oldY = car.y;
  car.x += car.dirX * car.speed * dt;
  car.y += car.dirY * car.speed * dt;

  // Building collision on the two axle points; a hard hit bleeds speed.
  let hitWall = false;
  for (const p of carPoints(car)) {
    const probe = { x: p.x, y: p.y };
    if (resolveCircle(city, probe, TUNING.carRadius)) {
      hitWall = true;
      car.x = oldX;
      car.y = oldY;
      car.speed *= 0.35;
      break;
    }
  }
  if (hitWall && Math.abs(car.speed) > 200) {
    state.shake = Math.max(state.shake, 5);
    spawnParticles(state, car.x, car.y, 8, '#ffd23e', 140);
  }

  // Shove traffic cars out of the way.
  for (const other of state.cars) {
    if (other === car || other.wrecked) continue;
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    if (d < 46 && d > 0.01) {
      const push = (46 - d) * 0.8;
      const nx = (other.x - car.x) / d;
      const ny = (other.y - car.y) / d;
      other.x += nx * push;
      other.y += ny * push;
      other.speed = Math.max(other.speed, 60);
      if (other.kind === 'traffic') other.target = null;
    }
  }

  // Keep the player glued to the car.
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
}

export function removeCar(state, id) {
  const i = state.cars.findIndex((c) => c.id === id);
  if (i >= 0) state.cars.splice(i, 1);
}
