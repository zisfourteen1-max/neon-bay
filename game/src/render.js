// NEON BAY — everything the player sees: the sun-soaked city, the cars and
// people in it, the HUD with its minimap, and the title, pause and game-over
// screens. All drawn with the canvas, no images.
import { AVENUES, BEACH_Y, CAR, DOCK_X, PALETTE, PLAYER, STREETS, WATER_Y, WORLD } from './config.js';
import { missionMarker, missionObjectiveText } from './missions.js';
import { clamp } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const L = CAR.length;
  const W = CAR.width;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
  ctx.fillStyle = car.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,24,32,0.85)';
  roundRect(ctx, -L / 2 + 10, -W / 2 + 5, 14, W - 10, 4);
  ctx.fill();
  roundRect(ctx, L / 2 - 24, -W / 2 + 5, 14, W - 10, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(L / 2 - 3, -W / 2 + 3, 3, 5);
  ctx.fillRect(L / 2 - 3, W / 2 - 8, 3, 5);
  if (car.brakeLight) {
    ctx.fillStyle = '#ff2e2e';
    ctx.fillRect(-L / 2, -W / 2 + 2, 3, 5);
    ctx.fillRect(-L / 2, W / 2 - 7, 3, 5);
  }
  if (car.police) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-6, -W / 2 + 2, 12, W - 4);
    ctx.fillStyle = '#2b4a8a';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
    const blink = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2e2e' : '#2e7bff';
    ctx.beginPath();
    ctx.arc(-8, -W / 2 - 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blink ? '#2e7bff' : '#ff2e2e';
    ctx.beginPath();
    ctx.arc(8, -W / 2 - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.gold) {
    ctx.fillStyle = '#fff3b0';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', 0, 4);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, skin, shirt, walkPhase, down) {
  ctx.save();
  ctx.translate(x, y);
  if (down > 0) {
    ctx.rotate(Math.PI / 2);
    ctx.globalAlpha = 0.7;
  }
  const bob = Math.sin(walkPhase) * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs
  ctx.fillStyle = '#2e2a26';
  ctx.fillRect(-6, 2 + bob, 4, 8);
  ctx.fillRect(2, 2 - bob, 4, 8);
  // Body
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -11, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWorld(ctx, G, view) {
  const { x: vx, y: vy, w: vw, h: vh } = view;
  // Grass base.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(vx - 40, vy - 40, vw + 80, vh + 80);
  // Park.
  const park = G.city.park;
  ctx.fillStyle = PALETTE.park;
  ctx.fillRect(park.x, park.y, park.w, park.h);
  // Docks (east strip) and beach + water (south).
  ctx.fillStyle = PALETTE.dock;
  ctx.fillRect(DOCK_X, 0, WORLD.w - DOCK_X, BEACH_Y);
  ctx.fillStyle = '#6e5f45';
  for (let y = 200; y < BEACH_Y; y += 260) ctx.fillRect(DOCK_X, y, WORLD.w - DOCK_X, 14);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, BEACH_Y, WORLD.w, WORLD.h - BEACH_Y);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(0, WATER_Y, WORLD.w, WORLD.h - WATER_Y);
  ctx.fillStyle = PALETTE.waterDeep;
  for (let x = 60; x < WORLD.w; x += 240) {
    ctx.beginPath();
    ctx.arc(x, WATER_Y + 46, 26, 0, Math.PI);
    ctx.fill();
  }
  // Sidewalks, then roads.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const ax of AVENUES) ctx.fillRect(ax - 46, 0, 92, BEACH_Y - 40);
  for (const sy of STREETS) ctx.fillRect(0, sy - 46, DOCK_X - 40, 92);
  ctx.fillStyle = PALETTE.road;
  for (const ax of AVENUES) ctx.fillRect(ax - 36, 0, 72, BEACH_Y - 40);
  for (const sy of STREETS) ctx.fillRect(0, sy - 36, DOCK_X - 40, 72);
  // Centre dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (const ax of AVENUES) {
    for (let y = 20; y < BEACH_Y - 60; y += 60) ctx.fillRect(ax - 2, y, 4, 30);
  }
  for (const sy of STREETS) {
    for (let x = 20; x < DOCK_X - 60; x += 60) ctx.fillRect(x, sy - 2, 30, 4);
  }
  // Named places: painted labels on the ground.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  for (const key of Object.keys(G.city.places)) {
    const p = G.city.places[key];
    ctx.fillText(p.label.toUpperCase(), p.x, p.y - 46);
  }
  // Trees.
  for (const t of G.city.trees) {
    ctx.fillStyle = t.palm ? '#8a6a3a' : '#5a4632';
    ctx.fillRect(t.x - 2, t.y - 2, 4, 6);
    ctx.fillStyle = t.palm ? '#3da06a' : '#2e7d32';
    ctx.beginPath();
    ctx.arc(t.x, t.y - 4, t.r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Buildings with roof colour and a shaded edge.
  for (const b of G.city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = PALETTE.buildingEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 10);
    if (b.height > 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25, b.w * 0.6, b.h * 0.5);
    }
  }
  // Street lamps.
  ctx.fillStyle = '#3a3f4a';
  for (const l of G.city.lamps) {
    ctx.beginPath();
    ctx.arc(l.x, l.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMarker(ctx, G) {
  const m = missionMarker(G);
  if (!m) return;
  const pulse = 1 + Math.sin(G.time * 4) * 0.12;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.strokeStyle = '#ffd21f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd21f';
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(10, -16);
  ctx.lineTo(-10, -16);
  ctx.closePath();
  ctx.fill();
  // A beam of light so the marker reads from far away.
  ctx.fillStyle = 'rgba(255,210,31,0.12)';
  ctx.beginPath();
  ctx.arc(0, 0, 60 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawMinimap(ctx, G, x, y, w, h) {
  const sx = w / WORLD.w;
  const sy = h / WORLD.h;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,22,0.78)';
  roundRect(ctx, x - 6, y - 6, w + 12, h + 12, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#2f6b3a';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#8a8f9a';
  ctx.lineWidth = 2;
  for (const ax of AVENUES) {
    ctx.beginPath();
    ctx.moveTo(x + ax * sx, y);
    ctx.lineTo(x + ax * sx, y + h);
    ctx.stroke();
  }
  for (const sy2 of STREETS) {
    ctx.beginPath();
    ctx.moveTo(x, y + sy2 * sy);
    ctx.lineTo(x + w, y + sy2 * sy);
    ctx.stroke();
  }
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(x, y + BEACH_Y * sy, w, (WORLD.h - BEACH_Y) * sy);
  const m = missionMarker(G);
  if (m) {
    ctx.fillStyle = '#ffd21f';
    ctx.beginPath();
    ctx.arc(x + m.x * sx, y + m.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const car of G.cars) {
    if (!car.police) continue;
    ctx.fillStyle = '#5aa2ff';
    ctx.beginPath();
    ctx.arc(x + car.x * sx, y + car.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const pp = G.player.inCar
    ? G.cars.find((c) => c.id === G.player.inCar) || G.player
    : G.player;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + pp.x * sx, y + pp.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawHUD(ctx, G, vw, vh) {
  const p = G.player;
  ctx.save();
  // Top-left: health, money, wanted stars.
  ctx.fillStyle = 'rgba(10,14,22,0.7)';
  roundRect(ctx, 12, 12, 250, 86, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${p.money}`, 24, 36);
  ctx.fillStyle = '#2e2a26';
  ctx.fillRect(24, 46, 180, 12);
  ctx.fillStyle = p.health > 30 ? '#3da06a' : '#d94f3d';
  ctx.fillRect(24, 46, 180 * (p.health / PLAYER.maxHealth), 12);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 46, 180, 12);
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.health)}`, 210, 57);
  // Wanted stars.
  ctx.font = '20px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i += 1) stars += i < G.wanted ? '★' : '☆';
  ctx.fillStyle = G.wanted > 0 ? '#ffd21f' : 'rgba(255,255,255,0.55)';
  ctx.fillText(stars, 24, 84);
  // Mission objective bar, top centre.
  const objective = missionObjectiveText(G);
  const label = G.mission ? `${G.mission.title} — ${G.mission.giver}` : 'NEON BAY';
  ctx.font = 'bold 14px sans-serif';
  const ow = Math.min(vw - 40, ctx.measureText(objective).width + 120);
  ctx.fillStyle = 'rgba(10,14,22,0.7)';
  roundRect(ctx, (vw - ow) / 2, 12, ow, 56, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd21f';
  ctx.textAlign = 'center';
  ctx.fillText(label, vw / 2, 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px sans-serif';
  ctx.fillText(objective, vw / 2, 52);
  // Ammo + speed, bottom-left.
  ctx.fillStyle = 'rgba(10,14,22,0.7)';
  roundRect(ctx, 12, vh - 64, 210, 52, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  if (p.inCar) {
    const car = G.cars.find((c) => c.id === p.inCar);
    const mph = car ? Math.round(Math.abs(car.speed) * 0.12) : 0;
    ctx.fillText(`${mph} mph`, 24, vh - 38);
    ctx.font = '12px sans-serif';
    ctx.fillText('E — exit car   Space — handbrake', 24, vh - 20);
  } else {
    const ammoText = p.reloadTimer > 0 ? 'RELOADING…' : `${p.ammo} / ${p.reserveAmmo}`;
    ctx.fillText(`AMMO ${ammoText}`, 24, vh - 38);
    ctx.font = '12px sans-serif';
    ctx.fillText('Click — shoot   E — steal car   R — reload', 24, vh - 20);
  }
  // Minimap, top-right.
  drawMinimap(ctx, G, vw - 216, 12, 200, 150);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NEON BAY', vw - 116, 176);
  ctx.restore();
}

function drawBanner(ctx, G, vw) {
  if (!G.banner) return;
  const alpha = clamp(G.banner.timer, 0, 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(10,14,22,0.82)';
  const w = 460;
  ctx.fillRect((vw - w) / 2, 120, w, 74);
  ctx.strokeStyle = '#ffd21f';
  ctx.lineWidth = 2;
  ctx.strokeRect((vw - w) / 2, 120, w, 74);
  ctx.fillStyle = '#ffd21f';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(G.banner.title, vw / 2, 150);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px sans-serif';
  ctx.fillText(G.banner.sub, vw / 2, 176);
  ctx.restore();
}

function drawMenu(ctx, G, vw, vh, kind) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  if (kind === 'title') {
    ctx.fillStyle = '#ff5e7a';
    ctx.font = 'bold 84px sans-serif';
    ctx.fillText('NEON BAY', vw / 2, vh / 2 - 120);
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('AN ORIGINAL OPEN-WORLD CRIME STORY', vw / 2, vh / 2 - 84);
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px sans-serif';
    ctx.fillText('You are Kit Marlowe, fresh out of the county lockup with $120 and a debt to pay.', vw / 2, vh / 2 - 44);
    ctx.fillText('Vera Voss runs the bay. Do her jobs, steal what you need, and stay ahead of the law.', vw / 2, vh / 2 - 20);
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#7ee2a0';
    ctx.fillText('CLICK TO START  —  or press Enter', vw / 2, vh / 2 + 26);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.fillText('WASD move  •  Mouse aim  •  Click shoot  •  E steal / exit car  •  Space punch / handbrake', vw / 2, vh / 2 + 62);
    ctx.fillText('R reload  •  M mute  •  P pause  •  Progress saves automatically', vw / 2, vh / 2 + 84);
    if (G.hasSave) {
      ctx.fillStyle = '#ffd21f';
      ctx.fillText('Saved progress found — your money and finished jobs are kept.', vw / 2, vh / 2 + 112);
    }
  } else if (kind === 'pause') {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('PAUSED', vw / 2, vh / 2 - 20);
    ctx.font = '16px sans-serif';
    ctx.fillText('Press P or Esc to keep playing', vw / 2, vh / 2 + 20);
    ctx.fillText(`Money $${G.player.money}  •  Jobs done ${G.stats.missionsDone} / 4  •  Cars stolen ${G.stats.carsStolen}`, vw / 2, vh / 2 + 48);
  } else if (kind === 'over') {
    ctx.fillStyle = '#ff5e5e';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('WASTED', vw / 2, vh / 2 - 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.fillText('The bay got the better of you this time.', vw / 2, vh / 2 + 8);
    ctx.fillText('Press R or click to try again — your money and finished jobs are saved.', vw / 2, vh / 2 + 34);
  } else if (kind === 'busted') {
    ctx.fillStyle = '#5aa2ff';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('BUSTED', vw / 2, vh / 2 - 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.fillText('The Neon Bay police took you in.', vw / 2, vh / 2 + 8);
    ctx.fillText('Press R or click to try again — your money and finished jobs are saved.', vw / 2, vh / 2 + 34);
  }
  if (G.storyComplete && kind === 'title') {
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('★ STORY COMPLETE — you ran every job in Neon Bay ★', vw / 2, vh / 2 + 140);
  }
  ctx.restore();
}

export function render(ctx, G, vw, vh) {
  const pp = G.player.inCar
    ? G.cars.find((c) => c.id === G.player.inCar) || G.player
    : G.player;
  const camX = clamp(pp.x, vw / 2, WORLD.w - vw / 2);
  const camY = clamp(pp.y, vh / 2, WORLD.h - vh / 2);
  G.camera.x = camX;
  G.camera.y = camY;
  G.viewW = vw;
  G.viewH = vh;
  const shakeX = G.shake > 0 ? (G.rng.next() - 0.5) * G.shake : 0;
  const shakeY = G.shake > 0 ? (G.rng.next() - 0.5) * G.shake : 0;

  ctx.save();
  ctx.translate(-camX + vw / 2 + shakeX, -camY + vh / 2 + shakeY);
  drawWorld(ctx, G, { x: camX - vw / 2 - 60, y: camY - vh / 2 - 60, w: vw + 120, h: vh + 120 });
  drawMarker(ctx, G);
  for (const car of G.cars) drawCar(ctx, car);
  for (const ped of G.peds) {
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.skin, ped.shirt, ped.walkPhase, 0);
  }
  for (const cop of G.cops) {
    if (cop.inCar) continue;
    drawPerson(ctx, cop.x, cop.y, cop.angle, '#e8b58a', '#2b4a8a', G.time * 8, cop.down || 0);
    // Cop hat.
    ctx.save();
    ctx.translate(cop.x, cop.y - 17);
    ctx.fillStyle = '#1c2f5e';
    ctx.fillRect(-7, -3, 14, 4);
    ctx.restore();
  }
  // The player: on foot a walking figure with an aim line, in a car the car itself.
  if (!G.player.inCar) {
    const p = G.player;
    drawPerson(ctx, p.x, p.y, p.angle, '#f0c8a0', '#ff5e7a', G.time * 9, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.aimAngle) * 18, p.y + Math.sin(p.aimAngle) * 18);
    ctx.lineTo(p.x + Math.cos(p.aimAngle) * 46, p.y + Math.sin(p.aimAngle) * 46);
    ctx.stroke();
    // Muzzle flash tracer.
    if (G.tracer && G.tracer.life > 0) {
      ctx.strokeStyle = 'rgba(255,215,106,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(G.tracer.x1, G.tracer.y1);
      ctx.lineTo(G.tracer.x2, G.tracer.y2);
      ctx.stroke();
    }
  }
  // Particles and popups.
  for (const pt of G.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  for (const pop of G.popups) {
    ctx.globalAlpha = clamp(pop.life, 0, 1);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, pop.x, pop.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Screen-space UI.
  if (G.screen === 'play' || G.screen === 'pause') drawHUD(ctx, G, vw, vh);
  drawBanner(ctx, G, vw);
  if (G.screen === 'title') drawMenu(ctx, G, vw, vh, 'title');
  if (G.screen === 'pause') drawMenu(ctx, G, vw, vh, 'pause');
  if (G.screen === 'over') drawMenu(ctx, G, vw, vh, 'over');
  if (G.screen === 'busted') drawMenu(ctx, G, vw, vh, 'busted');
  // Hurt vignette.
  if (G.player.hurtFlash > 0) {
    ctx.fillStyle = `rgba(217,30,30,${G.player.hurtFlash * 0.5})`;
    ctx.fillRect(0, 0, vw, vh);
  }
}
