// Deterministic screenshot scenes (?shot=menu|drive|chase|mission&seed=1).
// Each one stages the game so one frame shows several systems at once.
// main.js renders a few frames, then sets window.__shotReady.
import { PLACES } from './config.js';
import { startMission } from './missions.js';
import { makeCar } from './cars.js';

export function setupShot(mode, game) {
  const { state, city, rng } = game;
  state.shotMode = mode;
  if (mode === 'menu') {
    state.mode = 'title';
    state.camera = { x: 1240, y: 980 };
    state.player.x = 1240;
    state.player.y = 1100;
    return;
  }
  if (mode === 'drive') {
    state.mode = 'playing';
    startMission(state, 0, city, rng);
    state.mission.stage = 1; // package picked up — objective: deliver to the garage
    // Put the player in a car on 5th Avenue heading south, traffic around.
    const car = state.cars.find((c) => c.kind === 'parked') || makeCar('parked', 1440, 700, Math.PI / 2, 1);
    car.x = 1440;
    car.y = 700;
    car.angle = Math.PI / 2;
    car.speed = 320;
    car.dirX = 0;
    car.dirY = 1;
    state.player.inCar = car.id;
    state.player.x = car.x;
    state.player.y = car.y;
    state.player.angle = car.angle;
    state.camera = { x: car.x, y: car.y };
    return;
  }
  if (mode === 'chase') {
    state.mode = 'playing';
    startMission(state, 1, city, rng);
    state.mission.stage = 1; // gold Comet GT stolen — deliver to the Chop Shop
    state.wanted = 3;
    state.heatTimer = 0;
    const gold = state.cars.find((c) => c.id === state.mission.goldCarId);
    if (gold) {
      gold.x = 1840;
      gold.y = 1100;
      gold.angle = 0;
      gold.speed = 380;
      gold.dirX = 1;
      gold.dirY = 0;
      state.player.inCar = gold.id;
      state.player.x = gold.x;
      state.player.y = gold.y;
      state.player.angle = 0;
    }
    // Two police cars on the player's tail, one foot cop ahead.
    const cop1 = makeCar('police', 1690, 1100, 0, 2);
    cop1.color = '#1a1a2e';
    cop1.speed = 330;
    const cop2 = makeCar('police', 1840, 940, Math.PI / 2, 2);
    cop2.color = '#1a1a2e';
    cop2.speed = 330;
    state.cars.push(cop1, cop2);
    state.cops.push({ x: 1980, y: 1060, angle: Math.PI, speed: 205, down: false, downTimer: 0, busting: false });
    state.camera = { x: state.player.x, y: state.player.y };
    return;
  }
  if (mode === 'mission') {
    state.mode = 'playing';
    startMission(state, 3, city, rng);
    state.mission.stage = 1; // holding the bank vault
    state.mission.hold = 3.2;
    state.wanted = 2;
    state.heatTimer = 0;
    state.player.x = PLACES.bank.x;
    state.player.y = PLACES.bank.y + 40;
    state.player.angle = -Math.PI / 2;
    state.player.ammo = 7;
    state.camera = { x: state.player.x, y: state.player.y };
    const copCar = makeCar('police', PLACES.bank.x + 260, PLACES.bank.y, Math.PI, 2);
    copCar.color = '#1a1a2e';
    copCar.speed = 330;
    state.cars.push(copCar);
    state.cops.push({ x: PLACES.bank.x - 120, y: PLACES.bank.y + 60, angle: 0, speed: 205, down: false, downTimer: 0, busting: false });
    return;
  }
  // Unknown mode: just play.
  state.mode = 'playing';
}
