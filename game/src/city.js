// NEON BAY — the city itself: a road grid, blocks full of buildings, a park in
// the middle, a beach along the south shore and docks on the east edge. The
// layout is fixed by seed so the same seed always builds the same city.
import { AVENUES, BEACH_Y, DOCK_X, PALETTE, STREETS, WATER_Y, WORLD } from './config.js';
import { makeRng } from './random.js';

export function roadCenterX(avenueIndex) {
  return AVENUES[avenueIndex];
}

export function roadCenterY(streetIndex) {
  return STREETS[streetIndex];
}

// True when a point sits on a road (avenue or street), with a small margin.
export function onRoad(x, y, margin = 0) {
  const half = 36 + margin;
  for (const ax of AVENUES) if (Math.abs(x - ax) <= half && y < BEACH_Y - 40) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= half && x < DOCK_X - 40) return true;
  return false;
}

// The nearest intersection to a point (used to snap cars onto the grid).
export function nearestIntersection(x, y) {
  let bestX = AVENUES[0];
  let bestY = STREETS[0];
  for (const ax of AVENUES) if (Math.abs(ax - x) < Math.abs(bestX - x)) bestX = ax;
  for (const sy of STREETS) if (Math.abs(sy - y) < Math.abs(bestY - y)) bestY = sy;
  return { x: bestX, y: bestY };
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];

  // Park block: between avenues 1200-1600 and streets 800-1200.
  const park = { x: 1240, y: 840, w: 320, h: 320 };

  // One or two buildings per block, skipping the park block, the beach and docks.
  for (let ai = 0; ai < AVENUES.length - 1; ai += 1) {
    for (let si = 0; si < STREETS.length - 1; si += 1) {
      const x0 = AVENUES[ai] + 46;
      const y0 = STREETS[si] + 46;
      const x1 = AVENUES[ai + 1] - 46;
      const y1 = STREETS[si + 1] - 46;
      if (x0 > x1 || y0 > y1) continue;
      if (x0 >= park.x - 10 && y0 >= park.y - 10 && x0 < park.x + park.w && y0 < park.y + park.h) continue;
      if (y0 > BEACH_Y - 120) continue;
      if (x0 > DOCK_X - 120) continue;
      const count = rng.int(1, 2);
      for (let b = 0; b < count; b += 1) {
        const bw = rng.range(90, 170);
        const bh = rng.range(80, 150);
        const bx = rng.range(x0, Math.max(x0 + 1, x1 - bw));
        const by = rng.range(y0, Math.max(y0 + 1, y1 - bh));
        buildings.push({
          x: bx,
          y: by,
          w: bw,
          h: bh,
          color: rng.pick(PALETTE.buildingRoof),
          height: rng.int(1, 3),
        });
      }
      // A couple of trees per block, off the buildings.
      for (let t = 0; t < 2; t += 1) {
        trees.push({ x: rng.range(x0 + 10, x1 - 10), y: rng.range(y0 + 10, y1 - 10), r: rng.range(9, 15) });
      }
    }
  }

  // Palm trees along the beach and lamps along every avenue.
  for (let x = 120; x < WORLD.w - 60; x += 130) {
    trees.push({ x: x + rng.range(-20, 20), y: BEACH_Y + rng.range(14, 60), r: rng.range(10, 15), palm: true });
  }
  for (const ax of AVENUES) {
    for (const sy of STREETS) lamps.push({ x: ax + 44, y: sy - 44 });
  }

  // Named places the story uses. All original names, all inside the city.
  // Markers sit on roads or open ground, never inside a block, so a car or a
  // player on foot can always reach them.
  const places = {
    garage: { x: 820, y: 620, label: "Ray's Garage" },
    docks: { x: 3010, y: 1780, label: 'Neon Docks' },
    chopShop: { x: 2740, y: 210, label: 'Chop Shop' },
    bank: { x: 1560, y: 380, label: 'Bay Bank' },
    hideout: { x: 420, y: 1960, label: 'Hideout' },
    park: { x: park.x + park.w / 2, y: park.y + park.h / 2, label: 'Palm Park' },
  };

  return { buildings, trees, lamps, park, places, seed };
}

// Push a circle (player or car) out of every building it overlaps.
export function collideBuildings(city, x, y, radius) {
  let nx = x;
  let ny = y;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
    const dx = nx - cx;
    const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * radius;
      ny = cy + (dy / d) * radius;
    } else if (d2 <= 0.0001) {
      ny = b.y - radius;
    }
  }
  return { x: nx, y: ny };
}

// True when a circle overlaps a building (used to keep parked cars clear).
export function hitsBuilding(city, x, y, radius) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < radius * radius) return true;
  }
  return false;
}
