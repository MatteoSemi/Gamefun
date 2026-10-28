# Phosphor Arcade
Original local browser arcade, built with TypeScript, Canvas 2D and Vite.

Requires Node.js 22.12+ (Node 24 recommended) and npm. On Windows, macOS or Linux:

```sh
npm ci
npm run dev
```
Open the localhost address printed by Vite (normally http://localhost:5173). Keep the terminal running; Ctrl+C stops it. Do not open index.html directly.

```sh
npm run build
npm run preview
npm test
npx playwright install chromium firefox webkit
npm run test:browser
```
Gameplay requires no network after installation. All artwork is original and local. Build output is in dist/ and can be served by any local HTTP static server.

Implementation in progress; see PROGRESS.md for checkpoint status.
