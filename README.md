# Phosphor Arcade

Five complete local browser games in an original neon cabinet: **Neon Labyrinth** (Maze Chase), **Circuit Serpent** (Snake), **Dust Runner** (Dino Runner), **Midnight Crossing** (Road Hopper), and **Prism Breaker** (Breakout). Each supports solo and simultaneous side-by-side two-player competition on one keyboard.

## Install and run

Install **Node.js 22.12 or newer** and npm (Node 24 recommended). In this folder, on Windows, macOS, or Linux:

```sh
npm ci
npm run dev
```

Open **http://localhost:5173** (or the localhost port printed in the terminal if 5173 is busy). Keep the terminal open. Ctrl+C stops the server. No accounts, keys, services, or environment variables are required. Do not open `index.html` directly.

For an optimized static build:

```sh
npm run build
npm run preview
```

Open http://localhost:4173. `dist/` can also be served by any local HTTP static server. Gameplay uses **no internet** after installation. All assets are local, and there are no runtime package dependencies.

## Play

Click a card (or Tab to it and press Enter/Space), read the controls, and Start game. The book icon opens the full scrollable rulebook. The house at top left returns Home; the two-heads icon at top right opens the mode selector. Choose Solo / Two players and explicitly **Start new run** to replace a run. Closing this panel preserves the paused run. The same shared navigation bar sits above both playfields.

| Game | Solo | Player 1 / left | Player 2 / right |
| --- | --- | --- | --- |
| Maze Chase | WASD or arrows | WASD | Arrows |
| Snake | WASD or arrows | WASD | Arrows |
| Dino Runner | Space, W, Up jump; S, Down duck | W jump; S duck | Up jump; Down duck |
| Road Hopper | WASD or arrows | WASD | Arrows |
| Breakout | A/D or Left/Right move; Space launch | A/D move; W launch | Left/Right move; Up launch |

**Escape** or the visible **Pause / Resume** button pauses both worlds. Losing focus pauses automatically; resume deliberately. Held keys clear on pause, restart and navigation. Space is unused in two-player mode. Rematch / Restart makes a fresh run after one shared three-second countdown. One eliminated player freezes while the other continues; when both finish, the higher score wins, or equal scores draw. Rematches use the same starting seed. Some keyboards cannot report certain simultaneous key combinations (hardware rollover); try another combination or keyboard if a key is missed.

- **Maze:** pellets +10, power cores +50, frightened enemies +200; three lives. Buffered turns follow corridors. Clear all pellets for the next faster round.
- **Snake:** food +10; wall/body collision ends the run. No instant reversal; up to two turns queue. Speed caps at ~14 steps/second. Fill all 400 cells to win.
- **Runner:** score is distance / 10, rounded down. Jump ground obstacles, duck flying ones. Collision ends the run. Speed caps at 390 px/s; obstacle recovery gaps remain fair.
- **Road:** each newly reached forward row +10. Wait for traffic gaps and ride logs across water. Vehicles, water or drifting offscreen end the run. Safe banks recur between crossings; no time limit.
- **Breakout:** each brick +10; three lives. Launch after each lost ball. Paddle contact position determines angle. Clear 45 bricks for a faster round; speed caps at 490 px/s.

Solo bests and best individual multiplayer scores are saved separately in versioned localStorage. Records belong to the **current browser and localhost origin** (including port). Changing browser/port/hostname gives separate records. Blocked storage falls back to session records with a visible notice; corrupt entries are ignored and repaired. Runs never overwrite a higher best with a lower score.

## Validate

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run test:production
# With npm run dev still running in another terminal:
npm run test:gameplay
```

Browser tests use installed system Chromium when available at `/usr/bin/chromium`; otherwise they use Playwright's downloaded browser. Set `CHROMIUM_PATH` to override. For optional additional engines, install them with `npx playwright install firefox webkit`, then use `BROWSER_ENGINE=firefox npm run test:browser` or `BROWSER_ENGINE=webkit npm run test:browser` in a POSIX shell; in PowerShell use `$env:BROWSER_ENGINE="firefox"; npm run test:browser`. Linux browser installations may need `npx playwright install-deps` with appropriate system privileges. Network access is needed to download development packages and browser binaries, never to play.

`npm test` exercises deterministic mechanics, input, records and the match coordinator. `test:browser` starts/reuses the dev server and drives actual keyboard interactions; targeted development-only state controls exercise repeatable outcomes. `test:production` builds and tests all ten solo/duo flows against the actual static build in real time with external requests blocked, and confirms test controls are absent. JSON logs and screenshots are in `evidence/`; see **TEST_REPORT.md** for actual results and limitations.

## Structure

- `src/main.ts`, `style.css`, `catalog.ts`, `previews.ts`: semantic interface, rulebook and original previews.
- `src/session.ts`, `input.ts`, `storage.ts`, `types.ts`: shared fixed-step match coordination and services.
- `src/games/*.ts`: independent seeded game worlds; no DOM, timers or input listeners inside games.
- `tests/`: mechanics, services, coordinator and browser checks.
- `PROGRESS.md`, `DECISIONS.md`, `TEST_REPORT.md`: recovery notes and validation evidence.

The application uses one requestAnimationFrame loop and a 60 Hz simulation, with at most six catch-up steps. Canvas backing resolution follows devicePixelRatio while geometry retains its aspect ratio. Visuals use original Canvas/pixel artwork and inline SVG icons. No flashing CRT filters, sounds or external fonts are used.

## Troubleshooting

If the page is blank, run `npm ci` then `npm run dev` from this directory and use the printed localhost URL. A busy port makes Vite choose another port; records at that origin will differ. If gameplay does not respond after a dialog or switching windows, close the dialog and choose Resume; click no mouse controls inside a playfield. Update Node if Vite rejects the runtime. Browser test download policy failures affect test tooling only; an existing Chromium may be selected via `CHROMIUM_PATH`. Current desktop Chrome/Edge, Firefox and Safari are the browser targets; actual tested engines are listed in TEST_REPORT.md. Touch controls are not provided.
