// Vera Voss's four story missions: pickup, grand theft, losing the heat,
// and the Bay Bank heist. Pure state machine — no DOM, testable in Node.
import { PLACES } from './config.js';
import { addBanner, addFloater, spawnParticles, saveGame } from './state.js';
import { spawnGoldCar } from './cars.js';
import { addCrime } from './police.js';

export const MISSIONS = [
  {
    id: 1,
    title: 'First Job',
    brief: 'Pick up the package at the Neon Docks, then deliver it to Ray\u2019s Garage.',
    reward: 300,
  },
  {
    id: 2,
    title: 'Hot Wheels',
    brief: 'Steal the gold Comet GT and deliver it to the Chop Shop. The law will notice.',
    reward: 500,
  },
  {
    id: 3,
    title: 'Heat Wave',
    brief: 'You are at 3 stars. Lose the heat — get back to zero stars.',
    reward: 700,
  },
  {
    id: 4,
    title: 'Bay Heist',
    brief: 'Hold the Bay Bank vault for 5 seconds, then escape to the Hideout.',
    reward: 1500,
  },
];

export function startMission(state, index, city, rng) {
  const def = MISSIONS[index];
  if (!def) return;
  const mission = { id: def.id, stage: 0, timer: 0, elapsed: 0, hold: 0, goldCarId: null };
  state.mission = mission;
  if (def.id === 2) {
    const car = spawnGoldCar(state, city, rng);
    mission.goldCarId = car.id;
    addBanner(state, 'MISSION: HOT WHEELS', 'Steal the gold Comet GT. It is parked somewhere in Neon Bay.');
  } else if (def.id === 3) {
    state.wanted = 3;
    state.heatTimer = 0;
    addCrime(state, 0);
    addBanner(state, 'MISSION: HEAT WAVE', 'Three stars on you. Lose the heat — get to zero.');
  } else if (def.id === 1) {
    addBanner(state, 'MISSION: FIRST JOB', 'Pick up the package at the Neon Docks.');
  } else if (def.id === 4) {
    addBanner(state, 'MISSION: BAY HEIST', 'Get to the Bay Bank and hold the vault.');
  }
}

export function startNextMission(state, city, rng) {
  if (state.missionsDone >= MISSIONS.length) return;
  startMission(state, state.missionsDone, city, rng);
}

export function missionTarget(state) {
  const m = state.mission;
  if (!m) return null;
  if (m.id === 1) return m.stage === 0
    ? { x: PLACES.docks.x, y: PLACES.docks.y, label: 'Pick up the package' }
    : { x: PLACES.garage.x, y: PLACES.garage.y, label: 'Deliver to Ray\u2019s Garage' };
  if (m.id === 2) {
    if (m.stage === 0) {
      const car = state.cars.find((c) => c.id === m.goldCarId);
      return car
        ? { x: car.x, y: car.y, label: 'Steal the gold Comet GT' }
        : { x: PLACES.chopShop.x, y: PLACES.chopShop.y, label: 'Find the gold Comet GT' };
    }
    return { x: PLACES.chopShop.x, y: PLACES.chopShop.y, label: 'Deliver to the Chop Shop' };
  }
  if (m.id === 3) return { x: state.player.x, y: state.player.y, label: 'Lose the heat — reach 0 stars', self: true };
  if (m.id === 4) return m.stage === 0
    ? { x: PLACES.bank.x, y: PLACES.bank.y, label: 'Get to the Bay Bank' }
    : m.stage === 1
      ? { x: PLACES.bank.x, y: PLACES.bank.y, label: `Hold the vault… ${Math.ceil(5 - m.hold)}s` }
      : { x: PLACES.hideout.x, y: PLACES.hideout.y, label: 'Escape to the Hideout' };
  return null;
}

export function objectiveText(state) {
  const t = missionTarget(state);
  if (!t) return state.storyDone ? 'Story complete — Neon Bay is yours.' : 'Talk to Vera Voss.';
  const def = MISSIONS[state.mission.id - 1];
  return `${def.title} — ${t.label}`;
}

function completeMission(state) {
  const def = MISSIONS[state.mission.id - 1];
  state.money += def.reward;
  state.missionsDone += 1;
  state.mission = null;
  state.nextMissionTimer = 2.5;
  addBanner(state, 'MISSION COMPLETE', `${def.title} — +$${def.reward}`);
  addFloater(state, state.player.x, state.player.y - 34, `+$${def.reward}`, '#7dff6a');
  for (let i = 0; i < 40; i++) {
    spawnParticles(state, state.player.x, state.player.y, 1, ['#ff5ea8', '#3ae0ff', '#ffe14a', '#7dff6a'][i % 4], 260);
  }
  saveGame(state);
  if (state.missionsDone >= MISSIONS.length) {
    state.storyDone = true;
    state.mode = 'story';
  }
}

export function updateMission(state, dt) {
  const m = state.mission;
  if (!m) {
    if (!state.storyDone && state.mode === 'playing' && state.missionsDone < MISSIONS.length) {
      state.nextMissionTimer = (state.nextMissionTimer ?? 2.5) - dt;
      if (state.nextMissionTimer <= 0) {
        // The main loop passes city/rng via state._city/_rng (set at boot).
        startMission(state, state.missionsDone, state._city, state._rng);
      }
    }
    return;
  }
  m.elapsed += dt;
  const p = state.player;
  const near = (place, r) => Math.hypot(p.x - place.x, p.y - place.y) < (r || place.r);

  if (m.id === 1) {
    if (m.stage === 0 && near(PLACES.docks)) {
      m.stage = 1;
      addBanner(state, 'PACKAGE SECURED', 'Deliver it to Ray\u2019s Garage.');
      addFloater(state, p.x, p.y - 30, 'Package picked up', '#7dff6a');
    } else if (m.stage === 1 && near(PLACES.garage)) {
      completeMission(state);
    }
  } else if (m.id === 2) {
    if (m.stage === 0 && p.inCar === m.goldCarId) {
      m.stage = 1;
      state.wanted = Math.max(state.wanted, 2);
      state.heatTimer = 0;
      addBanner(state, 'COMET GT STOLEN', 'The Chop Shop is waiting. Lose the cops if you can.');
    } else if (m.stage === 1 && p.inCar === m.goldCarId && near(PLACES.chopShop)) {
      completeMission(state);
    }
  } else if (m.id === 3) {
    if (state.wanted === 0 && m.elapsed > 8) completeMission(state);
  } else if (m.id === 4) {
    if (m.stage === 0 && near(PLACES.bank)) {
      m.stage = 1;
      m.hold = 0;
      addBanner(state, 'VAULT BREACH', 'Hold the vault for 5 seconds!');
    } else if (m.stage === 1) {
      if (near(PLACES.bank)) {
        m.hold += dt;
        if (m.hold >= 5) {
          m.stage = 2;
          state.wanted = Math.max(state.wanted, 3);
          state.heatTimer = 0;
          addBanner(state, 'VAULT CRACKED — $1,500', 'Run! Escape to the Hideout.');
        }
      } else {
        m.hold = Math.max(0, m.hold - dt * 2);
      }
    } else if (m.stage === 2 && near(PLACES.hideout)) {
      completeMission(state);
    }
  }
}
