// NEON BAY — an original open-world crime game for make.fun's gta6-01 bounty
// (Node 22, standard library only). The game lives in this directory's game/
// folder: plain static files a desktop browser loads offline (game/index.html
// and its ES modules, no library and no network request). You play Kit Marlowe,
// fresh out of lockup in the sun-soaked coastal city of Neon Bay: explore on
// foot and by car, steal cars, outrun the Neon Bay police as your wanted level
// climbs, and run four story missions for the fixer Vera Voss. The program
// hands the game in: it copies game/ and screenshots/ from beside this file
// to /output and writes /output/dossier.json, the summary the judge reads,
// with the vendored make.fun library. Put your 3 or 4 PNG or JPEG screenshots
// in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// NEON BAY dossier: the game, its four screenshots and the judge's summary.
console.log(`Building the NEON BAY dossier into ${out}`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
