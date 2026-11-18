// Neon Bay's city: road grid, buildings, Palm Park, beach and docks.
// Pure geometry — no DOM, so Node can import it for logic tests.
import {
  WORLD_W, WORLD_H, AVENUES, STREETS, ROAD_W, SAND_TOP, WATER_TOP,
  DOCKS_LEFT, EAST_WATER_LEFT, PARK, SIGNS, COLORS,
} from './config.js';

export function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const lamps = [];
  const roadHalf = ROAD_W / 2;

  // Block columns (gaps between avenues, plus the two edges) and rows.
  const colEdges = [0, ...AVENUES, WORLD_W];
  const rowEdges = [0, ...STREETS, WORLD_H];

  for (let ci = 0; ci < colEdges.length - 1; ci++) {
    for (let ri = 0; ri < rowEdges.length - 1; ri++) {
      const bx0 = colEdges[ci] + (ci === 0 ? 8 : roadHalf + 12);
      const bx1 = colEdges[ci + 1] - (ci === colEdges.length - 2 ? 8 : roadHalf + 12);
      const by0 = rowEdges[ri] + (ri === 0 ? 8 : roadHalf + 12);
      const by1 = rowEdges[ri + 1] - (ri === rowEdges.length - 2 ? 8 : roadHalf + 12);
      if (bx1 - bx0 < 60 || by1 - by0 < 60) continue;
      // Skip the park block, the beach strip and the docks column.
      if (bx0 >= PARK.x - 20 && bx1 <= PARK.x + PARK.w + 20 && by0 >= PARK.y - 20 && by1 <= PARK.y + PARK.h + 20) continue;
      if (by1 >= SAND_TOP - 40) continue;
      if (bx1 >= DOCKS_LEFT - 40) continue;

      const count = rng.chance(0.45) ? 2 : 1;
      for (let k = 0; k < count; k++) {
        let x = bx0; let y = by0; let w = bx1 - bx0; let h = by1 - by0;
        if (count === 2) {
          if (w > h) { w = (w - 16) / 2; x = k === 0 ? bx0 : bx0 + w + 16; }
          else { h = (h - 16) / 2; y = k === 0 ? by0 : by0 + h + 16; }
        }
        if (w < 50 || h < 50) continue;
        buildings.push({
          x, y, w, h,
          color: rng.pick(COLORS.buildingRoof),
          neon: rng.pick(COLORS.neon),
          sign: rng.chance(0.55) ? rng.pick(SIGNS) : '',
          floors: Math.max(1, Math.round(h / 90)),
        });
      }
    }
  }

  // Palm trees in the park and along the beach.
  for (let i = 0; i < 26; i++) {
    trees.push({
      x: PARK.x + 20 + rng.range(0, PARK.w - 40),
      y: PARK.y + 20 + rng.range(0, PARK.h - 40),
      r: 7 + rng.range(0, 5),
    });
  }
  for (let i = 0; i < 18; i++) {
    trees.push({
      x: 60 + rng.range(0, WORLD_W - 220),
      y: SAND_TOP + 20 + rng.range(0, 60),
      r: 7 + rng.range(0, 5),
    });
  }

  // Street lamps at intersections.
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      lamps.push({ x: ax + ROAD_W / 2 + 8, y: sy + ROAD_W / 2 + 8 });
    }
  }

  return { buildings, trees, lamps };
}

export function isWater(x, y) {
  if (y >= WATER_TOP) return true;
  if (x >= EAST_WATER_LEFT) return true;
  return false;
}

export function isBeach(x, y) {
  return y >= SAND_TOP && y < WATER_TOP;
}

export function isOnRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_W / 2) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_W / 2) return true;
  return false;
}

// Push a circle out of buildings, water and the world edge. Returns true on hit.
// Runs a few passes: a push that lands outside the world is clamped back,
// and a clamp that lands inside a building is pushed out again.
export function resolveCircle(city, pos, radius) {
  let hit = false;
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const b of city.buildings) {
      const cx = Math.max(b.x, Math.min(pos.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(pos.y, b.y + b.h));
      const dx = pos.x - cx;
      const dy = pos.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < radius * radius) {
        hit = true;
        moved = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.y = cy + (dy / d) * radius;
        } else {
          // Centre inside the rect: pick the nearest exit that stays in the world.
          const left = pos.x - b.x;
          const right = b.x + b.w - pos.x;
          const top = pos.y - b.y;
          const bottom = b.y + b.h - pos.y;
          const candidates = [
            { x: b.x - radius, y: pos.y, d: left },
            { x: b.x + b.w + radius, y: pos.y, d: right },
            { x: pos.x, y: b.y - radius, d: top },
            { x: pos.x, y: b.y + b.h + radius, d: bottom },
          ];
          const valid = candidates.filter(
            (c) => c.x >= radius && c.x <= WORLD_W - radius && c.y >= radius && c.y <= WORLD_H - radius && !isWater(c.x, c.y),
          );
          const pick = (valid.length ? valid : candidates).sort((a, b) => a.d - b.d)[0];
          pos.x = pick.x;
          pos.y = pick.y;
        }
      }
    }
    if (isWater(pos.x, pos.y)) {
      hit = true;
      moved = true;
      if (pos.y >= WATER_TOP) pos.y = WATER_TOP - radius;
      if (pos.x >= EAST_WATER_LEFT) pos.x = EAST_WATER_LEFT - radius;
    }
    const clampedX = Math.max(radius, Math.min(WORLD_W - radius, pos.x));
    const clampedY = Math.max(radius, Math.min(WORLD_H - radius, pos.y));
    if (clampedX !== pos.x || clampedY !== pos.y) {
      hit = true;
      moved = true;
      pos.x = clampedX;
      pos.y = clampedY;
    }
    if (!moved) break;
  }
  return hit;
}

export function pointHitsBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// Nearest point on a road centreline — traffic and police cars steer along these.
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = { x: ax, y, axis: 'v' }; }
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; best = { x, y: sy, axis: 'h' }; }
  }
  return best;
}

export function randomIntersection(rng) {
  return {
    x: rng.pick(AVENUES),
    y: rng.pick(STREETS),
  };
}

// Free roadside parking spots for parked cars: just off a road, not in a building.
export function parkingSpot(city, rng) {
  for (let tries = 0; tries < 40; tries++) {
    const horizontal = rng.chance(0.5);
    const x = horizontal ? rng.pick(AVENUES) + (rng.chance(0.5) ? 1 : -1) * (ROAD_W / 2 + 12) : rng.range(120, WORLD_W - 420);
    const y = horizontal ? rng.range(120, SAND_TOP - 120) : rng.pick(STREETS) + (rng.chance(0.5) ? 1 : -1) * (ROAD_W / 2 + 12);
    if (isWater(x, y)) continue;
    if (pointHitsBuilding(city, x, y)) continue;
    return { x, y, angle: horizontal ? 0 : Math.PI / 2 };
  }
  return { x: 640, y: 420, angle: 0 };
}
