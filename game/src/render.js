// All canvas drawing: the city, every entity, the HUD with minimap,
// banners, and the title / pause / wasted / busted / story screens.
import {
  WORLD_W, WORLD_H, AVENUES, STREETS, ROAD_W, SAND_TOP, WATER_TOP,
  DOCKS_LEFT, EAST_WATER_LEFT, PARK, PLACES, COLORS, TUNING,
} from './config.js';
import { missionTarget, objectiveText } from './missions.js';

const ZOOM = 1.05;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function inView(cam, vw, vh, x, y, m) {
  return x > cam.x - vw / 2 - m && x < cam.x + vw / 2 + m && y > cam.y - vh / 2 - m && y < cam.y + vh / 2 + m;
}

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Body
  ctx.fillStyle = car.color;
  roundRect(ctx, -24, -12, 48, 24, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Roof + windshield
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -8, -10, 18, 20, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  ctx.fillRect(8, -10, 5, 20);
  // Headlights
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(21, -9, 3, 4);
  ctx.fillRect(21, 5, 3, 4);
  if (car.kind === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2, -12, 6, 24);
    const flash = Math.floor(time * 3) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#3b82ff';
    ctx.fillRect(-6, -12, 5, 6);
    ctx.fillStyle = flash ? '#3b82ff' : '#ff3b30';
    ctx.fillRect(-6, 6, 5, 6);
  }
  if (car.gold) {
    ctx.fillStyle = '#fff3a0';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GT', 0, 3);
  }
  ctx.restore();
}

function drawWorld(ctx, state, city, cam, vw, vh) {
  const vx0 = cam.x - vw / 2;
  const vy0 = cam.y - vh / 2;
  // Grass base
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(vx0, vy0, vw, vh);
  // Beach + water (south) and docks + water (east)
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(vx0, SAND_TOP, vw, WATER_TOP - SAND_TOP);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(vx0, WATER_TOP, vw, WORLD_H - WATER_TOP);
  ctx.fillStyle = COLORS.waterDeep;
  ctx.fillRect(EAST_WATER_LEFT, vy0, WORLD_W - EAST_WATER_LEFT, vh);
  ctx.fillStyle = COLORS.dockWood;
  ctx.fillRect(DOCKS_LEFT, vy0, EAST_WATER_LEFT - DOCKS_LEFT, vh);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  for (let y = Math.floor(vy0 / 46) * 46; y < vy0 + vh; y += 46) {
    ctx.beginPath();
    ctx.moveTo(DOCKS_LEFT, y);
    ctx.lineTo(EAST_WATER_LEFT, y);
    ctx.stroke();
  }
  // Water shimmer
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  for (let y = WATER_TOP + 20; y < WORLD_H; y += 54) {
    ctx.beginPath();
    for (let x = Math.floor(vx0 / 60) * 60; x < vx0 + vw; x += 60) {
      const yy = y + Math.sin(state.time * 1.4 + x * 0.02) * 3;
      if (x === Math.floor(vx0 / 60) * 60) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // Palm Park
  ctx.fillStyle = COLORS.parkGrass;
  ctx.fillRect(PARK.x, PARK.y, PARK.w, PARK.h);
  ctx.strokeStyle = '#3a6e38';
  ctx.lineWidth = 4;
  ctx.strokeRect(PARK.x, PARK.y, PARK.w, PARK.h);
  // Roads: sidewalk edge, asphalt, centre dashes
  for (const ax of AVENUES) {
    ctx.fillStyle = COLORS.sidewalk;
    ctx.fillRect(ax - ROAD_W / 2 - 10, vy0, ROAD_W + 20, vh);
    ctx.fillStyle = COLORS.asphalt;
    ctx.fillRect(ax - ROAD_W / 2, vy0, ROAD_W, vh);
  }
  for (const sy of STREETS) {
    ctx.fillStyle = COLORS.sidewalk;
    ctx.fillRect(vx0, sy - ROAD_W / 2 - 10, vw, ROAD_W + 20);
    ctx.fillStyle = COLORS.asphalt;
    ctx.fillRect(vx0, sy - ROAD_W / 2, vw, ROAD_W);
  }
  ctx.fillStyle = COLORS.roadLine;
  for (const ax of AVENUES) {
    for (let y = Math.floor(vy0 / 56) * 56; y < vy0 + vh; y += 56) {
      ctx.fillRect(ax - 2, y, 4, 26);
    }
  }
  for (const sy of STREETS) {
    for (let x = Math.floor(vx0 / 56) * 56; x < vx0 + vw; x += 56) {
      ctx.fillRect(x, sy - 2, 26, 4);
    }
  }
  // Buildings
  for (const b of city.buildings) {
    if (!inView(cam, vw, vh, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 10);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Windows
    ctx.fillStyle = 'rgba(255,240,180,0.75)';
    const cols = Math.floor(b.w / 34);
    const rows = Math.floor(b.h / 34);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 13 + b.x) % 3 === 0) {
          ctx.fillRect(b.x + 12 + i * 34, b.y + 26 + j * 34, 12, 14);
        }
      }
    }
    if (b.sign) {
      ctx.save();
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = b.neon;
      ctx.shadowBlur = 12;
      ctx.fillStyle = b.neon;
      ctx.fillText(b.sign, b.x + b.w / 2, b.y + b.h / 2 + 5);
      ctx.restore();
    }
  }
  // Palm trees
  for (const t of city.trees) {
    if (!inView(cam, vw, vh, t.x, t.y, 30)) continue;
    ctx.fillStyle = '#3d6b34';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#57a04e';
    ctx.beginPath();
    ctx.arc(t.x - 2, t.y - 2, t.r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Place labels
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  for (const key of Object.keys(PLACES)) {
    const place = PLACES[key];
    if (!inView(cam, vw, vh, place.x, place.y, 80)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const w = ctx.measureText(place.name).width + 14;
    roundRect(ctx, place.x - w / 2, place.y - 34, w, 20, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(place.name, place.x, place.y - 20);
  }
  // Mission target ring
  const target = missionTarget(state);
  if (target && !target.self) {
    const pulse = 1 + Math.sin(state.time * 5) * 0.12;
    ctx.strokeStyle = '#ffe14a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 44 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffe14a';
    ctx.beginPath();
    ctx.arc(target.x, target.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEntities(ctx, state, city, cam, vw, vh) {
  for (const car of state.cars) {
    if (!inView(cam, vw, vh, car.x, car.y, 60)) continue;
    drawCar(ctx, car, state.time);
  }
  for (const ped of state.peds) {
    if (!inView(cam, vw, vh, ped.x, ped.y, 40)) continue;
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.mode === 'down') {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f0c8a0';
      ctx.beginPath();
      ctx.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  for (const cop of state.cops) {
    if (!inView(cam, vw, vh, cop.x, cop.y, 40)) continue;
    ctx.save();
    ctx.translate(cop.x, cop.y);
    if (cop.down) {
      ctx.fillStyle = '#2c3e6b';
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#22355e';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#101c38';
      ctx.fillRect(-7, -14, 14, 6);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(4, 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  // Player on foot (when driving, the car is the player)
  const p = state.player;
  if (!p.inCar && inView(cam, vw, vh, p.x, p.y, 40)) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = '#ff5e3a';
    ctx.beginPath();
    ctx.arc(0, 0, TUNING.playerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a1e08';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath();
    ctx.arc(Math.cos(p.angle) * 5, Math.sin(p.angle) * 5, 6, 0, Math.PI * 2);
    ctx.fill();
    // Gun barrel
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(p.angle) * 8, Math.sin(p.angle) * 8);
    ctx.lineTo(Math.cos(p.angle) * 20, Math.sin(p.angle) * 20);
    ctx.stroke();
    ctx.restore();
  }
  // Tracers
  for (const t of state.tracers) {
    ctx.strokeStyle = `rgba(255,225,74,${Math.max(0, 1 - t.t * 6)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }
  // Particles
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, 1 - pt.t / pt.life);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMinimap(ctx, state, x, y, w, h) {
  const sx = w / WORLD_W;
  const sy = h / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,24,0.85)';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // Water + park
  ctx.fillStyle = '#1d6d8f';
  ctx.fillRect(x, y + WATER_TOP * sy, w, (WORLD_H - WATER_TOP) * sy);
  ctx.fillRect(x + EAST_WATER_LEFT * sx, y, (WORLD_W - EAST_WATER_LEFT) * sx, h);
  ctx.fillStyle = '#4f8a4a';
  ctx.fillRect(x + PARK.x * sx, y + PARK.y * sy, PARK.w * sx, PARK.h * sy);
  // Roads
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
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
  // Mission target
  const target = missionTarget(state);
  if (target) {
    const pulse = 3 + Math.sin(state.time * 5) * 1.5;
    ctx.fillStyle = '#ffe14a';
    ctx.beginPath();
    ctx.arc(x + target.x * sx, y + target.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cops + police cars
  ctx.fillStyle = '#3b82ff';
  for (const cop of state.cops) {
    if (cop.down) continue;
    ctx.beginPath();
    ctx.arc(x + cop.x * sx, y + cop.y * sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const car of state.cars) {
    if (car.kind === 'police') ctx.fillRect(x + car.x * sx - 2, y + car.y * sy - 2, 4, 4);
  }
  // Player
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + state.player.x * sx, y + state.player.y * sy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff5e3a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + state.player.x * sx, y + state.player.y * sy, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx, state, canvas) {
  const p = state.player;
  ctx.textAlign = 'left';
  // Top-left: health + money + ammo/speed
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 14, 14, 230, 78, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('KIT MARLOWE', 26, 34);
  ctx.fillStyle = '#222';
  roundRect(ctx, 26, 42, 180, 12, 6);
  ctx.fill();
  const hpFrac = Math.max(0, p.health / TUNING.playerHealth);
  ctx.fillStyle = hpFrac > 0.5 ? '#7dff6a' : hpFrac > 0.25 ? '#ffe14a' : '#ff5e6a';
  roundRect(ctx, 26, 42, 180 * hpFrac, 12, 6);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`$${state.money.toLocaleString('en-US')}`, 26, 76);
  ctx.font = '13px sans-serif';
  if (p.inCar) {
    const car = state.cars.find((c) => c.id === p.inCar);
    const mph = car ? Math.round(Math.abs(car.speed) * 0.12) : 0;
    ctx.fillText(`${mph} mph  ·  ${car ? car.model : ''}`, 120, 76);
  } else {
    ctx.fillText(p.reloading > 0 ? 'Reloading…' : `Ammo ${p.ammo} / ${TUNING.pistolAmmo}`, 120, 76);
  }
  // Bust meter
  if (state.bustMeter > 0.05) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, 14, 100, 230, 22, 10);
    ctx.fill();
    ctx.fillStyle = '#ff5e6a';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('BUSTED IN', 26, 115);
    ctx.fillStyle = '#ff5e6a';
    ctx.fillRect(96, 104, 130 * (state.bustMeter / TUNING.bustTime), 12);
  }
  // Top-right: wanted stars
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, canvas.width - 214, 14, 200, 40, 10);
  ctx.fill();
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '☆';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = state.wanted > 0 ? '#ffe14a' : 'rgba(255,255,255,0.5)';
  ctx.fillText(stars, canvas.width - 28, 43);
  // Mission objective bar (top-centre)
  const obj = objectiveText(state);
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px sans-serif';
  const ow = Math.min(560, ctx.measureText(obj).width + 36);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, canvas.width / 2 - ow / 2, 14, ow, 34, 10);
  ctx.fill();
  ctx.fillStyle = '#ffe14a';
  ctx.fillText(obj, canvas.width / 2, 36);
  // Hold progress for the bank vault
  if (state.mission && state.mission.id === 4 && state.mission.stage === 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, canvas.width / 2 - 110, 54, 220, 12, 6);
    ctx.fill();
    ctx.fillStyle = '#3ae0ff';
    roundRect(ctx, canvas.width / 2 - 110, 54, 220 * (state.mission.hold / 5), 12, 6);
    ctx.fill();
  }
  // Minimap (bottom-right)
  drawMinimap(ctx, state, canvas.width - 214, canvas.height - 164, 200, 150);
  ctx.textAlign = 'left';
  // Off-screen mission arrow
  const target = missionTarget(state);
  if (target && !target.self) {
    const cam = state.camera;
    const vw = canvas.width / ZOOM;
    const vh = canvas.height / ZOOM;
    const dx = target.x - cam.x;
    const dy = target.y - cam.y;
    if (Math.abs(dx) > vw / 2 - 60 || Math.abs(dy) > vh / 2 - 60) {
      const ang = Math.atan2(dy, dx);
      const ex = canvas.width / 2 + Math.cos(ang) * (canvas.width / 2 - 70);
      const ey = canvas.height / 2 + Math.sin(ang) * (canvas.height / 2 - 70);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffe14a';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffe14a';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(Math.hypot(dx, dy))}m`, ex, ey + 28);
      ctx.textAlign = 'left';
    }
  }
  // Banner
  if (state.banner) {
    const b = state.banner;
    const alpha = Math.min(1, b.t < 0.3 ? b.t / 0.3 : (b.life - b.t) / 0.6);
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const bw = Math.max(420, ctx.measureText(b.text).width + 60);
    roundRect(ctx, canvas.width / 2 - bw / 2, 92, bw, b.sub ? 66 : 46, 12);
    ctx.fill();
    ctx.fillStyle = '#ffe14a';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(b.text, canvas.width / 2, 122);
    if (b.sub) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '15px sans-serif';
      ctx.fillText(b.sub, canvas.width / 2, 146);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
  // Floaters
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  for (const f of state.floaters) {
    const sx = (f.x - (state.camera.x - canvas.width / ZOOM / 2)) * ZOOM;
    const sy = (f.y - (state.camera.y - canvas.height / ZOOM / 2)) * ZOOM - f.t * 30;
    ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, sx, sy);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  // Hurt vignette
  const hurt = state.time - state.player.lastHurt < 0.6 || state.player.health < 30;
  if (hurt) {
    const a = state.player.health < 30 ? 0.28 : 0.35 * (1 - (state.time - state.player.lastHurt) / 0.6);
    const grad = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, canvas.height * 0.35,
      canvas.width / 2, canvas.height / 2, canvas.height * 0.75,
    );
    grad.addColorStop(0, 'rgba(255,0,0,0)');
    grad.addColorStop(1, `rgba(255,0,0,${Math.max(0, Math.min(0.4, a))})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawScreen(ctx, state, canvas, lines, title, titleColor) {
  ctx.fillStyle = 'rgba(8,10,24,0.82)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = titleColor;
  ctx.font = 'bold 64px sans-serif';
  ctx.shadowColor = titleColor;
  ctx.shadowBlur = 24;
  ctx.fillText(title, canvas.width / 2, 170);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = '17px sans-serif';
  let y = 230;
  for (const line of lines) {
    ctx.fillText(line, canvas.width / 2, y);
    y += 30;
  }
  ctx.textAlign = 'left';
}

export function draw(state, ctx, city, canvas) {
  const cam = state.camera;
  const vw = canvas.width / ZOOM;
  const vh = canvas.height / ZOOM;
  ctx.save();
  ctx.scale(ZOOM, ZOOM);
  if (state.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  ctx.translate(-(cam.x - vw / 2), -(cam.y - vh / 2));
  drawWorld(ctx, state, city, cam, vw, vh);
  drawEntities(ctx, state, city, cam, vw, vh);
  ctx.restore();

  if (state.mode === 'playing' || state.mode === 'paused') drawHud(ctx, state, canvas);

  if (state.mode === 'title') {
    const save = state.hasSave ? state.saveInfo : null;
    const lines = [
      'Kit Marlowe is out of lockup with $120 and a debt to pay.',
      'Vera Voss has four jobs for you in the sun-soaked city of Neon Bay.',
      'Steal cars, outrun the police, and pull the Bay Bank heist.',
      '',
      'WASD move · Mouse aim · Click shoot · Space punch · R reload',
      'E enter / steal car · Shift run · Space handbrake in a car · P pause · M mute',
      '',
    ];
    if (save) {
      lines.push(state.titleChoice === 1 ? '▶ CONTINUE — $' + save.money + ', ' + save.missionsDone + ' jobs done' : '  CONTINUE — $' + save.money + ', ' + save.missionsDone + ' jobs done');
      lines.push(state.titleChoice === 0 ? '▶ NEW GAME' : '  NEW GAME');
      lines.push('Up / Down to choose · Enter to start');
    } else {
      lines.push('Press ENTER to start');
    }
    drawScreen(ctx, state, canvas, lines, 'NEON BAY', '#ff5ea8');
  } else if (state.mode === 'paused') {
    drawScreen(ctx, state, canvas, ['The city waits.', '', 'P / Esc — resume', 'M — mute', 'E — enter / steal a car'], 'PAUSED', '#3ae0ff');
  } else if (state.mode === 'wasted') {
    drawScreen(ctx, state, canvas, ['Kit Marlowe flatlines on the Neon Bay asphalt.', '', 'Press ENTER to restart at the Hideout'], 'WASTED', '#ff5e6a');
  } else if (state.mode === 'busted') {
    drawScreen(ctx, state, canvas, ['The Neon Bay PD takes Kit Marlowe in.', '', 'Press ENTER to restart at the Hideout'], 'BUSTED', '#3b82ff');
  } else if (state.mode === 'story') {
    drawScreen(ctx, state, canvas, [
      'All four jobs done. The Bay Bank money is yours.',
      `Money: $${state.money.toLocaleString('en-US')} · Cars stolen: ${state.stats.steals} · Shots fired: ${state.stats.shots}`,
      '',
      'Press ENTER to keep playing — Neon Bay is yours now.',
    ], 'NEON BAY IS YOURS', '#7dff6a');
  }
}
