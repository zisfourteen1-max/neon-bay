// NEON BAY — game boot and main loop.
// Kit Marlowe, fresh out of lockup, does four jobs for Vera Voss
// in the sun-soaked coastal city of Neon Bay.
import { WORLD_W, WORLD_H, PLACES, TUNING } from './config.js';
import { makeRng } from './random.js';
import { createGame, loadSave, saveGame } from './state.js';
import { buildCity } from './city.js';
import { spawnTraffic, spawnParked, updateTraffic, updatePlayerCar } from './cars.js';
import { spawnPeds, updatePeds, knockPedDown } from './pedestrians.js';
import { updateWanted, ensurePolice, updateCops, updatePoliceCars, addCrime } from './police.js';
import { updateMission, startNextMission } from './missions.js';
import { updatePlayer } from './player.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { draw } from './render.js';
import { setupShot } from './shots.js';

const ZOOM = 1.05;

function boot() {
  const params = new URLSearchParams(window.location.search);
  const seed = parseInt(params.get('seed') || '1', 10) || 1;
  const shotMode = params.get('shot');

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  const rng = makeRng(seed);
  const state = createGame(seed);
  const city = buildCity(rng);
  state._city = city;
  state._rng = rng;

  spawnTraffic(state, city, rng, 16);
  spawnParked(state, city, rng, 12);
  spawnPeds(state, city, rng, 26);

  const save = loadSave();
  state.hasSave = !!save;
  state.saveInfo = save || null;
  state.titleChoice = save ? 1 : 0;

  const input = new Input(canvas);
  const audio = new AudioEngine();

  if (shotMode) setupShot(shotMode, { state, city, rng });

  function startGame() {
    audio.ensure();
    audio.startBassline();
    const saveData = state.saveInfo;
    if (state.titleChoice === 1 && saveData) {
      state.money = saveData.money;
      state.missionsDone = Math.min(4, saveData.missionsDone || 0);
    } else {
      state.money = 120;
      state.missionsDone = 0;
    }
    state.mode = 'playing';
    state.nextMissionTimer = 0.6;
    state.player.x = PLACES.hideout.x;
    state.player.y = PLACES.hideout.y + 60;
    state.camera = { x: state.player.x, y: state.player.y };
  }

  function restart() {
    const p = state.player;
    p.health = TUNING.playerHealth;
    p.ammo = TUNING.pistolAmmo;
    p.reloading = 0;
    p.inCar = null;
    p.x = PLACES.hideout.x;
    p.y = PLACES.hideout.y + 60;
    state.wanted = state.mission && state.mission.id === 3 ? 3 : 0;
    state.heatTimer = 0;
    state.bustMeter = 0;
    state.cops = [];
    state.cars = state.cars.filter((c) => c.kind !== 'police');
    state.camera = { x: p.x, y: p.y };
    state.mode = 'playing';
    saveGame(state);
  }

  function updateCamera(dt) {
    const vw = canvas.width / ZOOM;
    const vh = canvas.height / ZOOM;
    const tx = state.player.x;
    const ty = state.player.y;
    const k = Math.min(1, dt * 5);
    state.camera.x += (tx - state.camera.x) * k;
    state.camera.y += (ty - state.camera.y) * k;
    state.camera.x = Math.max(vw / 2 - 60, Math.min(WORLD_W - vw / 2 + 60, state.camera.x));
    state.camera.y = Math.max(vh / 2 - 60, Math.min(WORLD_H - vh / 2 + 60, state.camera.y));
  }

  function updatePlaying(dt) {
    if (input.pressed('KeyM')) {
      state.muted = !state.muted;
      audio.setMuted(state.muted);
    }
    if (input.pressed('KeyP') || input.pressed('Escape')) {
      state.mode = 'paused';
      audio.setEngine(false, 0);
      audio.setSiren(false);
      return;
    }
    // Mouse position in world coordinates.
    const vw = canvas.width / ZOOM;
    const vh = canvas.height / ZOOM;
    input.mouseWorldX = state.camera.x - vw / 2 + input.mouseX / ZOOM;
    input.mouseWorldY = state.camera.y - vh / 2 + input.mouseY / ZOOM;

    updatePlayer(state, city, input, audio, dt);
    if (state.player.inCar) {
      const carInput = {
        up: input.keys.has('KeyW') || input.keys.has('ArrowUp'),
        down: input.keys.has('KeyS') || input.keys.has('ArrowDown'),
        left: input.keys.has('KeyA') || input.keys.has('ArrowLeft'),
        right: input.keys.has('KeyD') || input.keys.has('ArrowRight'),
        handbrake: input.keys.has('Space'),
      };
      updatePlayerCar(state, city, carInput, dt);
      // Running pedestrians over is a crime.
      const car = state.cars.find((c) => c.id === state.player.inCar);
      if (car && Math.abs(car.speed) > 120) {
        for (const ped of state.peds) {
          if (ped.mode !== 'down' && Math.hypot(ped.x - car.x, ped.y - car.y) < 36) {
            knockPedDown(state, ped);
            if ((state.carHitCooldown || 0) <= 0) {
              addCrime(state, 1);
              state.carHitCooldown = 2;
            }
          }
        }
      }
    }
    state.carHitCooldown = Math.max(0, (state.carHitCooldown || 0) - dt);

    updateTraffic(state, city, rng, dt);
    updatePeds(state, city, dt);
    updateWanted(state, dt);
    ensurePolice(state, city, rng, dt);
    updateCops(state, city, dt);
    updatePoliceCars(state, city, dt);
    updateMission(state, dt);
    updateCamera(dt);

    // Autosave every few seconds.
    state.saveTimer += dt;
    if (state.saveTimer >= TUNING.saveEvery) {
      state.saveTimer = 0;
      saveGame(state);
    }

    // Engine hum + siren follow the game.
    const car = state.player.inCar ? state.cars.find((c) => c.id === state.player.inCar) : null;
    audio.setEngine(!!car, car ? Math.abs(car.speed) / TUNING.carMaxSpeed : 0);
    audio.setSiren(state.wanted >= 2);
  }

  function updateAmbient(dt) {
    // Title screen: the city lives behind the menu.
    updateTraffic(state, city, rng, dt);
    updatePeds(state, city, dt);
    state.camera = { x: 1240, y: 980 };
  }

  function update(dt) {
    state.time += dt;
    if (state.banner) {
      state.banner.t += dt;
      if (state.banner.t >= state.banner.life) state.banner = null;
    }
    for (const f of state.floaters) f.t += dt;
    state.floaters = state.floaters.filter((f) => f.t < f.life);
    for (const t of state.tracers) t.t += dt;
    state.tracers = state.tracers.filter((t) => t.t < 0.12);
    for (const pt of state.particles) {
      pt.t += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.98;
      pt.vy *= 0.98;
    }
    state.particles = state.particles.filter((pt) => pt.t < pt.life);
    state.shake = Math.max(0, state.shake - dt * 22);

    if (state.mode === 'title') {
      updateAmbient(dt);
      if (input.pressed('ArrowUp') || input.pressed('ArrowDown')) {
        if (state.hasSave) state.titleChoice = state.titleChoice === 0 ? 1 : 0;
      }
      if (input.pressed('Enter')) startGame();
    } else if (state.mode === 'playing') {
      updatePlaying(dt);
    } else if (state.mode === 'paused') {
      if (input.pressed('KeyP') || input.pressed('Escape') || input.pressed('Enter')) {
        state.mode = 'playing';
      }
    } else if (state.mode === 'wasted' || state.mode === 'busted') {
      if (input.pressed('Enter')) restart();
    } else if (state.mode === 'story') {
      updateAmbient(dt);
      if (input.pressed('Enter')) {
        state.mode = 'playing';
        state.nextMissionTimer = 9999; // free roam: no more missions
      }
    }
  }

  // Debug handle for play-testing (CDP) — no secrets, just the live state.
  window.__neonBay = { state, city, startGame, restart, version: 'neon-bay-1' };

  let last = performance.now();
  let frames = 0;
  function loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    update(dt);
    draw(state, ctx, city, canvas);
    input.endFrame();
    frames++;
    if (state.shotMode && frames >= 3 && !state.shotReady) {
      state.shotReady = true;
      window.__shotReady = true;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

boot();
