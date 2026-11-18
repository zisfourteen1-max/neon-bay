// NEON BAY — pedestrians: locals strolling the sidewalks, who run away when
// shots ring out or a car bears down on them.
import { AVENUES, STREETS, WORLD } from './config.js';
import { collideBuildings } from './city.js';
import { clamp, dist } from './random.js';
import { makePed, playerPos } from './state.js';

export function updatePeds(G, dt) {
  const pp = playerPos(G);
  const inCar = !!G.player.inCar;
  for (let i = G.peds.length - 1; i >= 0; i -= 1) {
    const ped = G.peds[i];
    ped.walkPhase += dt * 8;
    // Flee from gunfire, or from a fast car closing in.
    if (ped.flee > 0) {
      ped.flee -= dt;
      const a = Math.atan2(ped.y - pp.y, ped.x - pp.x);
      ped.x += Math.cos(a) * 150 * dt;
      ped.y += Math.sin(a) * 150 * dt;
    } else {
      const nearCar = inCar && dist(ped.x, ped.y, pp.x, pp.y) < 120;
      if (nearCar) ped.flee = 1.2;
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      // At an intersection, sometimes pick a new direction along the grid.
      const nearX = AVENUES.some((ax) => Math.abs(ped.x - ax) < 52);
      const nearY = STREETS.some((sy) => Math.abs(ped.y - sy) < 52);
      if ((nearX || nearY) && G.rng.chance(dt * 0.5)) {
        ped.angle = G.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      }
      // Turn back at the world edge or the beach.
      if (ped.x < 80 || ped.x > WORLD.w - 80 || ped.y < 80 || ped.y > WORLD.h - 200) {
        ped.angle += Math.PI;
      }
    }
    const fixed = collideBuildings(G.city, ped.x, ped.y, 12);
    ped.x = fixed.x;
    ped.y = fixed.y;
    ped.x = clamp(ped.x, 40, WORLD.w - 40);
    ped.y = clamp(ped.y, 40, WORLD.h - 40);
    // A pedestrian hit by the player's car is knocked down and runs off.
    if (inCar) {
      const car = G.cars.find((c) => c.id === G.player.inCar);
      if (car && Math.abs(car.speed) > 60 && dist(ped.x, ped.y, car.x, car.y) < 34) {
        ped.flee = 4;
        ped.x += (ped.x - car.x) * 0.4;
        ped.y += (ped.y - car.y) * 0.4;
      }
    }
  }
  // Keep the streets populated: replace anyone who wandered too far away.
  if (G.peds.length < 22) {
    const x = clamp(pp.x + G.rng.range(-700, 700), 90, WORLD.w - 90);
    const y = clamp(pp.y + G.rng.range(-500, 500), 90, WORLD.h - 240);
    G.peds.push(makePed(G.rng, x, y));
  }
}
