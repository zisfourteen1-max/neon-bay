// NEON BAY — the player: walking the streets, aiming with the mouse, shooting
// and punching, and getting in and out of cars.
import { CAR, PLAYER } from './config.js';
import { collideBuildings } from './city.js';
import { angleTo, clamp, dist } from './random.js';
import { addParticles, addPopup } from './state.js';
import { commitCrime } from './police.js';
import { drivePlayerCar, nearestStealableCar, stealCar } from './cars.js';

export function updatePlayer(G, input, dt, sfx) {
  const p = G.player;
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.punchTimer = Math.max(0, p.punchTimer - dt);
  p.reloadTimer = Math.max(0, p.reloadTimer - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);

  if (p.inCar) {
    const car = G.cars.find((c) => c.id === p.inCar);
    if (!car) {
      p.inCar = null;
    } else {
      const speedRatio = drivePlayerCar(G, car, input, dt);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.speed = car.speed;
      // E steps out of the car.
      if (input.hit('e')) {
        p.inCar = null;
        p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
        p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
        car.speed = 0;
      }
      return { speedRatio, driving: true };
    }
  }

  // On foot: WASD moves, the mouse aims.
  const axis = input.axis();
  const len = Math.hypot(axis.x, axis.y) || 1;
  const running = input.down('shift');
  const speed = (running ? PLAYER.runSpeed : PLAYER.walkSpeed);
  p.x += (axis.x / len) * speed * dt * (axis.x || axis.y ? 1 : 0);
  p.y += (axis.y / len) * speed * dt * (axis.x || axis.y ? 1 : 0);
  if (axis.x || axis.y) p.angle = Math.atan2(axis.y, axis.x);
  const fixed = collideBuildings(G.city, p.x, p.y, PLAYER.radius);
  p.x = fixed.x;
  p.y = fixed.y;
  p.x = clamp(p.x, 20, 3180);
  p.y = clamp(p.y, 20, 2380);
  p.speed = (axis.x || axis.y) ? speed : 0;

  // Aim at the mouse (screen space -> world space via the camera).
  const cam = G.camera;
  const viewW = G.viewW || 1280;
  const viewH = G.viewH || 720;
  const worldMouseX = cam.x - viewW / 2 + input.mouseX;
  const worldMouseY = cam.y - viewH / 2 + input.mouseY;
  p.aimAngle = angleTo(p.x, p.y, worldMouseX, worldMouseY);

  // Click (or hold) to shoot; R reloads; Space punches.
  if (input.mouseDown && p.cooldown <= 0 && p.reloadTimer <= 0) {
    if (p.ammo > 0) {
      fireBullet(G, sfx);
    } else {
      startReload(G, sfx);
    }
  }
  if (input.hit('r')) startReload(G, sfx);
  if (input.hit(' ') && p.punchTimer <= 0) {
    p.punchTimer = PLAYER.punchCooldown;
    punch(G, sfx);
  }
  if (p.reloadTimer <= 0 && p.ammo === 0 && p.reserveAmmo > 0) {
    // Auto reload when the magazine runs dry.
    startReload(G, sfx);
  }
  // E steals the nearest car.
  if (input.hit('e')) {
    const car = nearestStealableCar(G, p.x, p.y);
    if (car) {
      stealCar(G, car);
      commitCrime(G, 1);
      addPopup(G, car.x, car.y - 40, 'CAR STOLEN', '#e8b13d');
      if (sfx) sfx.pickup();
    }
  }
  return { speedRatio: 0, driving: false };
}

function startReload(G, sfx) {
  const p = G.player;
  if (p.reloadTimer > 0 || p.ammo === PLAYER.magSize || p.reserveAmmo <= 0) return;
  p.reloadTimer = PLAYER.reloadTime;
  p.reloading = true;
  if (sfx) sfx.reload();
  // The reload finishes in the main loop (see finishReload).
}

export function finishReload(G) {
  const p = G.player;
  if (p.reloadTimer > 0) return;
  if (p.ammo < PLAYER.magSize && p.reserveAmmo > 0 && p.reloading) {
    const need = PLAYER.magSize - p.ammo;
    const take = Math.min(need, p.reserveAmmo);
    p.ammo += take;
    p.reserveAmmo -= take;
    p.reloading = false;
  }
}

export function fireBullet(G, sfx) {
  const p = G.player;
  p.ammo -= 1;
  p.cooldown = PLAYER.pistolCooldown;
  p.reloading = false;
  G.stats.shotsFired += 1;
  const range = PLAYER.pistolRange;
  const ax = Math.cos(p.aimAngle);
  const ay = Math.sin(p.aimAngle);
  const muzzleX = p.x + ax * 20;
  const muzzleY = p.y + ay * 20;
  addParticles(G, muzzleX, muzzleY, '#ffd76a', 4, 140);
  G.shake = Math.max(G.shake, 2);
  if (sfx) sfx.shoot();
  commitCrime(G, 1);

  // Hitscan: the first pedestrian, cop or car along the aim line takes the hit.
  let bestD = range;
  let bestKind = null;
  let bestTarget = null;
  for (const ped of G.peds) {
    const d = rayHit(muzzleX, muzzleY, ax, ay, ped.x, ped.y, 16);
    if (d !== null && d < bestD) { bestD = d; bestKind = 'ped'; bestTarget = ped; }
  }
  for (const cop of G.cops) {
    if (cop.inCar) continue;
    const d = rayHit(muzzleX, muzzleY, ax, ay, cop.x, cop.y, 16);
    if (d !== null && d < bestD) { bestD = d; bestKind = 'cop'; bestTarget = cop; }
  }
  for (const car of G.cars) {
    const d = rayHit(muzzleX, muzzleY, ax, ay, car.x, car.y, 30);
    if (d !== null && d < bestD) { bestD = d; bestKind = 'car'; bestTarget = car; }
  }
  const hx = muzzleX + ax * bestD;
  const hy = muzzleY + ay * bestD;
  G.tracer = { x1: muzzleX, y1: muzzleY, x2: hx, y2: hy, life: 0.08 };
  if (bestKind === 'ped') {
    bestTarget.flee = 5;
    addParticles(G, hx, hy, '#d94f3d', 10, 160);
    addPopup(G, hx, hy - 20, `-${PLAYER.pistolDamage}`, '#ff6a5e');
  } else if (bestKind === 'cop') {
    // Shooting a cop drops them: they stay down for a while.
    bestTarget.down = 6;
    bestTarget.x += ax * 30;
    bestTarget.y += ay * 30;
    addParticles(G, hx, hy, '#2b4a8a', 10, 160);
    addPopup(G, hx, hy - 20, 'COP DOWN', '#7fb5ff');
    commitCrime(G, 1);
  } else if (bestKind === 'car') {
    addParticles(G, hx, hy, '#e8b13d', 8, 160);
    if (bestTarget.traffic) {
      bestTarget.speed = 0;
      bestTarget.targetSpeed = 0;
    }
  } else {
    addParticles(G, hx, hy, '#cccccc', 3, 80);
  }
}

// Distance along the ray to a circle, or null when the ray misses it.
function rayHit(ox, oy, dx, dy, cx, cy, r) {
  const lx = cx - ox;
  const ly = cy - oy;
  const t = lx * dx + ly * dy;
  if (t < 0) return null;
  const px = ox + dx * t;
  const py = oy + dy * t;
  const d2 = (cx - px) * (cx - px) + (cy - py) * (cy - py);
  if (d2 > r * r) return null;
  return t - Math.sqrt(Math.max(0, r * r - d2));
}

export function punch(G, sfx) {
  const p = G.player;
  if (sfx) sfx.punch();
  const px = p.x + Math.cos(p.aimAngle) * 30;
  const py = p.y + Math.sin(p.aimAngle) * 30;
  for (const ped of G.peds) {
    if (dist(p.x, p.y, px, py) < PLAYER.punchRange) {
      ped.flee = 4;
      ped.x += Math.cos(p.aimAngle) * 26;
      ped.y += Math.sin(p.aimAngle) * 26;
      addPopup(G, ped.x, ped.y - 20, `-${PLAYER.punchDamage}`, '#ff6a5e');
      addParticles(G, ped.x, ped.y, '#ffd76a', 6, 120);
    }
  }
  for (const cop of G.cops) {
    if (cop.inCar) continue;
    if (dist(cop.x, cop.y, px, py) < PLAYER.punchRange) {
      cop.down = 4;
      addPopup(G, cop.x, cop.y - 20, 'COP DOWN', '#7fb5ff');
      commitCrime(G, 1);
    }
  }
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.health <= 0) return;
  p.health -= amount;
  p.hurtFlash = 0.35;
  if (p.health <= 0) {
    p.health = 0;
    G.screen = 'over';
  }
}
