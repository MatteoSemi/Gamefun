# Validation report

Tested 29 October 2026 (Europe/Berlin), Linux x64, Node 24.19.0, npm 11.9.0. Actual browser: **Chromium 154.0.8037.57**, headless, through Playwright 1.61.1. No human play session is claimed: gameplay checks used real browser keyboard events, automated observation, deterministic stepping, and separate real-time production tests.

## Results

| Check | Actual result | Evidence |
| --- | --- | --- |
| `npm test` | 46 tests passed, 0 failed, 0 skipped | `evidence/logic-results.txt` |
| `npm run build` | Strict TypeScript and Vite production build passed | `evidence/build-results.txt` |
| `npm run test:browser` | 17 Chromium tests passed, 0 failed | `evidence/browser-results.json` |
| `node tests/gameplay.mjs` | All five keyboard gameplay replays passed | `evidence/exploratory.json`, `gameplay-*.png` |
| `npm run test:production` | All 10 solo/duo flows passed in the static production build, device scale 2; 0 external requests, 0 page/asset errors | `evidence/production-results.json` |

## Mechanics and gameplay evidence

The repeatable gameplay script fixes a starting seed (424242) before application initialization, disables requestAnimationFrame in that test page, and drives **actual keyboard events** with 60 Hz coordinator steps. It reads state for route planning; it does not teleport the player, remove hazards, change scores, or mutate worlds. This complements the normal animation-loop browser tests and real-time static-build tests.

- **Maze:** keyboard path across 16 cells collected 200 points, including a real power pellet activating 8 seconds of frightened state; all three lives remained. Unit tests flood-fill every required pellet across 80 seeded mazes, and check buffered turns, walls, frightened enemy scoring, three losses, safe respawn, round progression and independent equal seeds.
- **Snake:** ate two foods, reached 20 points and five cells through directional key presses. Unit tests cover rapid turn ordering, reversal rejection, legal entry into a vacated tail cell, food exclusion, full-board victory, self/wall collisions, speed cap and independent RNG.
- **Runner:** replay survived through 979 points, jumped generated ground hazards 15 times and ducked a generated flyer. Unit tests verify jump/landing, repeat suppression, duck hitboxes, grounded-only ducking, deterministic hazards, AABB collision and speed-aware spacing at the supported cap.
- **Road:** keyboard hops reached row 12, 110 points; waited for moving traffic, crossed river logs, rode 20 pixels with log motion and scrolled camera to row 7. Unit tests verify safe start/banks, vehicle gaps/log widths over generated rows, wrapped support, drowning, car collision, log carry, independent seeded lanes, score anti-farming and speed cap. This checks generation invariants and representative crossings, not an exhaustive proof of every infinite route.
- **Breakout:** keyboard paddle play broke 15 bricks (150 points), returned the ball 13 times and retained three lives. Deliberately moving away caused an actual missed ball and reduced lives to two; Space relaunched it. Unit tests check swept fast-ball collision, exact corners, parallel misses, varied paddle rebound, life loss/relaunch, round clear and wall corners. A separate 36,000-tick tracking-paddle simulation reached round 3 without sticking or invalid ball state.

## Browser interactions and multiplayer

All five previews launch the corresponding game, with controls displayed before Start. Each game was tested solo and with two simultaneous independent playfields. The browser suite checks assigned WASD/arrows and launch/jump/duck bindings, duo Space isolation, shared countdown, explicit mode confirmation, return to solo, Home, rulebook, Pause/Resume, restart/rematch, and keyboard menu activation.

For deterministic outcome tests, the suite intentionally marks a player eliminated through the **development-only test interface**, then tests the actual coordinator freezing that world while the survivor continues. It checks winner and draw results, and both-world rematch reset. These are controlled outcome tests; they are separate from the unmodified-world keyboard gameplay described above.

Records persist over refresh and lower-score restarts, and solo/duo values stay separate. Corrupt JSON recovers; blocked/unavailable storage keeps gameplay and session records with a notice. Unit tests additionally check malformed individual values, write failures, and merging higher scores from another tab.

Focus-loss events pause both worlds, clear held keys and require deliberate resume. Holding Escape does not repeatedly toggle pause. Rapid turns, repeated restarts/navigation, resizing to 560 px, and an actual devicePixelRatio 2 context preserve input and aspect ratio. External network requests were blocked while all ten modes loaded and played; none were attempted. The production test also confirms `window.arcade` is absent from built assets at runtime. No uncaught page errors or missing assets occurred in tested flows.

## Screenshots

- `evidence/home.png`: original five-card menu and records.
- `evidence/rulebook.png`: accessible scrollable modal.
- `evidence/solo-maze.png`: solo game with shared navigation and score display.
- `evidence/split-screen.png`: side-by-side independent runner worlds, shared bar, player labels.
- `evidence/gameplay-{maze,snake,runner,road,breakout}.png`: representative progressed keyboard gameplay.

## Limits

- **Firefox, WebKit, Safari and Edge were not tested.** Playwright browser binary downloads were blocked by this environment's network policy; the installed system Chromium was used. A WebKit test, if run later, would still not establish testing Safari itself.
- Windows/macOS launch commands are documented and use portable Node/npm tooling, but only Linux was actually executed. Physical keyboard rollover and monitor refresh rates were not measured on hardware.
- No human playtesting, screen-reader audit, physical touchscreen tests or multi-hour browser soak is claimed. Touch controls and optional sound are not implemented.
- No known blocking defects remain in the tested flows. The normal run is endless in Maze/Runner/Road/Breakout; Snake has a full-board victory. Lives and round progression match the rulebook.
