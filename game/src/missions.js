// NEON BAY — the story: four jobs for Vera Voss, a fixer who runs the bay
// from a back room above Ray's Garage. Each mission has stages, a map marker,
// a reward in dollars, and a tracker line on the HUD.
import { addPopup, setBanner } from './state.js';
import { dist } from './random.js';
import { commitCrime } from './police.js';

export const MISSIONS = [
  {
    id: 'pickup',
    title: 'First Job',
    giver: 'Vera Voss',
    intro: 'Vera needs a package from the docks. Go get it, no questions.',
    reward: 300,
    steps: [
      { text: 'Drive to Neon Docks and pick up the package', place: 'docks', radius: 70 },
      { text: "Deliver the package to Ray's Garage", place: 'garage', radius: 70 },
    ],
  },
  {
    id: 'hotwheels',
    title: 'Hot Wheels',
    giver: 'Vera Voss',
    intro: 'A gold Comet GT is parked by Palm Park. Steal it. The heat is on you.',
    reward: 500,
    steps: [
      { text: 'Steal the gold Comet GT by Palm Park', car: 'gold', radius: 0 },
      { text: 'Deliver the Comet to the Chop Shop', place: 'chopShop', radius: 70 },
    ],
  },
  {
    id: 'heatwave',
    title: 'Heat Wave',
    giver: 'Vera Voss',
    intro: 'The whole bay is looking for you. Lose the cops and go dark.',
    reward: 700,
    steps: [
      { text: 'Lose the cops — get your wanted level to zero', loseHeat: true },
    ],
  },
  {
    id: 'heist',
    title: 'Bay Heist',
    giver: 'Vera Voss',
    intro: 'One last job: the Bay Bank vault. Grab the cash and vanish.',
    reward: 1500,
    steps: [
      { text: 'Reach the Bay Bank and hold the vault', place: 'bank', radius: 70, hold: 5 },
      { text: 'Escape to the Hideout', place: 'hideout', radius: 80 },
    ],
  },
];

export function startMission(G, index, sfx) {
  const m = MISSIONS[index];
  G.missionIndex = index;
  G.mission = m;
  G.missionStage = 0;
  G.missionTimer = 0;
  G.missionHold = 0;
  G.missionDone = false;
  setBanner(G, m.title, `${m.giver}: ${m.intro}`, 3.4);
  if (sfx) sfx.missionStart();
  if (m.id === 'heatwave') commitCrime(G, 3);
}

export function currentStep(G) {
  if (!G.mission) return null;
  return G.mission.steps[G.missionStage] || null;
}

export function missionMarker(G) {
  const step = currentStep(G);
  if (!step) return null;
  if (step.car === 'gold') {
    const car = G.cars.find((c) => c.id === G.goldCarId);
    return car ? { x: car.x, y: car.y } : null;
  }
  if (step.place) {
    const p = G.city.places[step.place];
    return p ? { x: p.x, y: p.y } : null;
  }
  return null;
}

export function missionObjectiveText(G) {
  const step = currentStep(G);
  if (!step) return 'No active job — press M to see the map, or take the next job.';
  if (step.loseHeat) return `${step.text}  (wanted: ${G.wanted}★)`;
  if (step.hold) return `${step.text}  (${Math.ceil(step.hold - G.missionHold)}s)`;
  return step.text;
}

// Advance the mission one step; complete it when the last step is done.
function advanceMission(G, sfx) {
  G.missionStage += 1;
  G.missionHold = 0;
  if (G.missionStage >= G.mission.steps.length) {
    const reward = G.mission.reward;
    G.player.money += reward;
    G.stats.missionsDone += 1;
    G.completedMissions.push(G.mission.id);
    G.missionDone = true;
    setBanner(G, 'Job Complete', `+$${reward}  —  ${G.mission.title}`, 3);
    if (sfx) sfx.missionComplete();
    const pp = { x: G.player.x, y: G.player.y };
    for (let i = 0; i < 40; i += 1) {
      const a = G.rng.range(0, Math.PI * 2);
      const s = G.rng.range(60, 260);
      G.particles.push({
        x: pp.x, y: pp.y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60,
        life: G.rng.range(0.6, 1.2), maxLife: 1.2,
        color: G.rng.pick(['#e8b13d', '#d94f3d', '#3da06a', '#3d7bd9', '#e8e8e8']),
        size: G.rng.range(3, 6),
      });
    }
    if (G.missionIndex >= MISSIONS.length - 1) {
      G.storyComplete = true;
    }
    G.mission = null;
  } else if (sfx) {
    sfx.pickup();
  }
}

export function updateMissions(G, dt, sfx) {
  if (!G.mission) {
    // Offer the next job automatically after a short breather.
    if (G.missionIndex < MISSIONS.length && !G.storyComplete) {
      G.missionTimer += dt;
      if (G.missionTimer > 4 && G.missionIndex < MISSIONS.length) {
        startMission(G, G.missionIndex, sfx);
        G.missionTimer = 0;
      }
    }
    return;
  }
  const step = currentStep(G);
  if (!step) return;
  const px = G.player.inCar
    ? (G.cars.find((c) => c.id === G.player.inCar) || G.player).x
    : G.player.x;
  const py = G.player.inCar
    ? (G.cars.find((c) => c.id === G.player.inCar) || G.player).y
    : G.player.y;

  if (step.loseHeat) {
    if (G.wanted === 0) advanceMission(G, sfx);
    return;
  }
  if (step.car === 'gold') {
    if (G.player.inCar === G.goldCarId) {
      commitCrime(G, 2);
      addPopup(G, px, py - 40, 'STOLEN!', '#d9a521');
      advanceMission(G, sfx);
    }
    return;
  }
  if (step.place) {
    const p = G.city.places[step.place];
    const d = dist(px, py, p.x, p.y);
    if (d < step.radius) {
      if (step.hold) {
        G.missionHold += dt;
        if (G.missionHold >= step.hold) {
          commitCrime(G, 3);
          addPopup(G, p.x, p.y - 40, 'CASH GRABBED!', '#e8b13d');
          advanceMission(G, sfx);
        }
      } else {
        if (G.mission.id === 'pickup' && G.missionStage === 0 && sfx) sfx.pickup();
        advanceMission(G, sfx);
      }
    } else {
      G.missionHold = Math.max(0, G.missionHold - dt * 2);
    }
  }
}

export function saveProgress(G) {
  try {
    localStorage.setItem('neonbay-save-v1', JSON.stringify({
      money: G.player.money,
      completed: G.completedMissions,
      next: G.storyComplete ? MISSIONS.length : G.missionIndex,
    }));
  } catch (e) { /* storage unavailable: the game still plays */ }
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem('neonbay-save-v1');
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.money !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}
