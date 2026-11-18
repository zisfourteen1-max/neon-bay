// NEON BAY — the game loop: screens, saving, the frame step, and the
// deterministic screenshot mode (?shot=menu|drive|chase|mission&seed=1).
import { SoundBank } from './audio.js';
import { updateTraffic } from './cars.js';
import { Input } from './input.js';
import { loadProgress, saveProgress, startMission, updateMissions } from './missions.js';
import { updatePeds } from './pedestrians.js';
import { finishReload, updatePlayer } from './player.js';
import { updatePolice } from './police.js';
import { render } from './render.js';
import { stageShot } from './shots.js';
import { createGame } from './state.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
const sfx = new SoundBank();
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 1) || 1;

let G = createGame(seed);
let last = performance.now();
let shotReady = false;
let saveTimer = 0;

// Read-only handle for play-testing (browser automation reads the game state;
// it changes nothing and the game never reads it back).
window.__neonbay = {
  get screen() { return G.screen; },
  get wanted() { return G.wanted; },
  get money() { return G.player.money; },
  get health() { return G.player.health; },
  get inCar() { return !!G.player.inCar; },
  get pos() { return { x: Math.round(G.player.x), y: Math.round(G.player.y) }; },
  get angle() { return G.player.angle; },
  get speed() { return Math.round(Math.abs(G.player.speed || 0)); },
  get ammo() { return G.player.ammo; },
  get mission() { return G.mission ? { title: G.mission.title, stage: G.missionStage } : null; },
  get cops() { return G.cops.length; },
  get cars() { return G.cars.length; },
  get peds() { return G.peds.length; },
};

function resize() {
  const w = Math.floor(window.innerWidth);
  const h = Math.floor(window.innerHeight);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}
window.addEventListener('resize', resize);
resize();

// Restore the player's money and finished jobs, if any.
const saved = loadProgress();
if (saved) {
  G.hasSave = true;
  G.player.money = saved.money;
  G.completedMissions = Array.isArray(saved.completed) ? saved.completed.slice() : [];
  G.missionIndex = Math.min(saved.next || 0, 4);
  if (G.missionIndex >= 4) G.storyComplete = true;
}

function startGame() {
  sfx.ensure();
  sfx.startMusic();
  G.screen = 'play';
  if (G.missionIndex < 4 && !G.mission) startMission(G, G.missionIndex, sfx);
}

function restart() {
  const money = G.player.money;
  const completed = G.completedMissions.slice();
  const index = G.storyComplete ? 4 : G.missionIndex;
  G = createGame(seed);
  G.player.money = money;
  G.completedMissions = completed;
  G.missionIndex = index;
  G.hasSave = true;
  if (index >= 4) G.storyComplete = true;
  G.screen = 'play';
  if (index < 4) startMission(G, index, sfx);
}

function step(dt) {
  G.time += dt;
  const driving = updatePlayer(G, input, dt, sfx);
  finishReload(G);
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt, sfx);
  updateMissions(G, dt, sfx);
  // Particles and popups.
  for (const pt of G.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy += 120 * dt;
  }
  G.particles = G.particles.filter((pt) => pt.life > 0);
  for (const pop of G.popups) {
    pop.life -= dt;
    pop.y -= 26 * dt;
  }
  G.popups = G.popups.filter((pop) => pop.life > 0);
  if (G.tracer) {
    G.tracer.life -= dt;
    if (G.tracer.life <= 0) G.tracer = null;
  }
  if (G.banner) {
    G.banner.timer -= dt;
    if (G.banner.timer <= 0) G.banner = null;
  }
  G.shake = Math.max(0, G.shake - dt * 22);
  // Engine hum and sirens follow the action.
  sfx.engine(driving.speedRatio || 0, driving.driving);
  sfx.siren(G.wanted > 0 && G.screen === 'play', dt);
  // Autosave every few seconds while playing.
  saveTimer += dt;
  if (saveTimer > 5) {
    saveTimer = 0;
    saveProgress(G);
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  resize();

  if (shotName) {
    // Screenshot mode: the staged frame repaints every frame, nothing moves.
    render(ctx, G, canvas.width, canvas.height);
    if (!shotReady) {
      shotReady = true;
      window.__shotReady = true;
    }
    requestAnimationFrame(frame);
    return;
  }

  if (input.hit('m')) {
    G.muted = !G.muted;
    sfx.setMuted(G.muted);
  }

  if (G.screen === 'title') {
    if (input.mouseClicked || input.hit('enter') || input.hit(' ')) startGame();
    G.time += dt;
    updateTraffic(G, dt);
    updatePeds(G, dt);
  } else if (G.screen === 'play') {
    if (input.hit('p') || input.hit('escape')) {
      G.screen = 'pause';
      sfx.engine(0, false);
      sfx.siren(false, dt);
    } else {
      step(dt);
    }
  } else if (G.screen === 'pause') {
    if (input.hit('p') || input.hit('escape')) G.screen = 'play';
  } else if (G.screen === 'over' || G.screen === 'busted') {
    if (input.hit('r') || input.mouseClicked) restart();
  }

  render(ctx, G, canvas.width, canvas.height);
  input.endFrame();
  requestAnimationFrame(frame);
}

if (shotName) {
  stageShot(shotName, G);
  G.screen = shotName === 'menu' ? 'title' : 'play';
}

requestAnimationFrame(frame);
