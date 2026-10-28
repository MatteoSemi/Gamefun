/** Exploratory mechanics run using real browser keyboard events at deterministic 60 Hz.
 * Requires npm run dev in another terminal. No game/world state is modified.
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const evidence = fileURLToPath(new URL('../evidence/', import.meta.url));
mkdirSync(evidence, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
const report = {
  method: 'Real Chromium keyboard events drive deterministic 60 Hz session ticks. requestAnimationFrame is disabled in this test page; the development-only step hook drives the same session update/render path. No world state mutations or teleports. State is read only for route planning. Date.now is fixed before app startup to seed layouts reproducibly.',
  browser: browser.version(), seed: 424242, games: {}, errors
};
try {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 1; Date.now = () => 424242; });
  await page.goto(process.env.ARCADE_URL || 'http://localhost:5173');
  const step = n => page.evaluate(n => window.arcade.step(n), n);
  const state = () => page.evaluate(() => JSON.parse(JSON.stringify(window.arcade.session.worlds[0])));
  const screenshot = name => page.screenshot({ path: `${evidence}/gameplay-${name}.png` });
  async function launch(id) {
    if (await page.locator('#home').count()) await page.locator('#home').click();
    await page.locator(`[data-game="${id}"]`).click();
    await page.locator('#start').click();
    await step(181);
  }
  function path(start, target, walk) {
    const queue = [[start, []]], seen = new Set([`${start.x},${start.y}`]);
    for (let i = 0; i < queue.length; i++) {
      const [pos, route] = queue[i];
      if (pos.x === target.x && pos.y === target.y) return route;
      for (const [dx, dy, key] of [[0, -1, 'ArrowUp'], [0, 1, 'ArrowDown'], [-1, 0, 'ArrowLeft'], [1, 0, 'ArrowRight']]) {
        const next = { x: pos.x + dx, y: pos.y + dy }, id = `${next.x},${next.y}`;
        if (!seen.has(id) && walk(next)) { seen.add(id); queue.push([next, [...route, { ...next, key }]]); }
      }
    }
    return null;
  }

  await launch('maze');
  let maze = await state();
  const routes = [{ x: 17, y: 19 }, { x: 1, y: 1 }, { x: 17, y: 1 }]
    .map(target => path(maze.player, target, next => maze.walls[next.y]?.[next.x] === false)).filter(Boolean).sort((a, b) => a.length - b.length);
  let moves = 0;
  for (const move of routes[0]) {
    await page.keyboard.press(move.key);
    for (let i = 0; i < 15; i++) {
      await step(1); const now = await state();
      if (now.player.x === move.x && now.player.y === move.y) { moves++; break; }
      assert.equal(now.lives, maze.lives, 'Maze route must survive patrol');
    }
  }
  maze = await state();
  assert.ok(maze.score >= 50 && maze.frightened > 0 && maze.lives === 3, 'Maze must collect pellets and activate power through keyboard movement');
  report.games.maze = { moves, score: maze.score, lives: maze.lives, powerSeconds: maze.frightened, player: maze.player, ghostPositions: maze.ghosts.map(g => g.pos) };
  await screenshot('maze');

  await launch('snake');
  let snake;
  for (let attempts = 0; attempts < 100; attempts++) {
    snake = await state(); if (snake.over || snake.score >= 20) break;
    const occupied = new Set(snake.snake.slice(0, -1).map(cell => `${cell.x},${cell.y}`));
    const route = path(snake.snake[0], snake.food, n => n.x >= 0 && n.x < 20 && n.y >= 0 && n.y < 20 && !occupied.has(`${n.x},${n.y}`));
    assert.ok(route?.length, 'Food must have a traversable keyboard route');
    const move = route[0]; await page.keyboard.press(move.key);
    for (let i = 0; i < 12; i++) { await step(1); snake = await state(); if (snake.over || (snake.snake[0].x === move.x && snake.snake[0].y === move.y)) break; }
  }
  snake = await state();
  assert.ok(snake.score >= 20 && snake.snake.length >= 5 && !snake.over, 'Snake must eat two foods and grow');
  report.games.snake = { score: snake.score, length: snake.snake.length, over: snake.over, food: snake.food };
  await screenshot('snake');

  await launch('runner');
  let jumps = 0, ducked = false, groundPassFrames = 0, birdPassFrames = 0, duck = false;
  for (let i = 0; i < 3000; i++) {
    const runner = await state(); if (runner.over) break;
    const threat = runner.obstacles.find(o => o.x + o.w > 75);
    if (threat?.kind === 'bird') {
      if (threat.x < 165 && !duck) { await page.keyboard.down('ArrowDown'); duck = true; }
    } else if (threat && threat.x < 175 && threat.x > 100 && runner.y === 356 && runner.velocity === 0) { await page.keyboard.press('ArrowUp'); jumps++; }
    if (duck && (!threat || threat.kind !== 'bird' || threat.x + threat.w < 75)) { await page.keyboard.up('ArrowDown'); duck = false; ducked = true; }
    if (runner.obstacles.some(o => o.kind !== 'bird' && o.x + o.w < 72)) groundPassFrames++;
    if (runner.obstacles.some(o => o.kind === 'bird' && o.x + o.w < 72)) birdPassFrames++;
    await step(1); if (birdPassFrames > 20 && groundPassFrames > 0) break;
  }
  await page.keyboard.up('ArrowDown'); const runner = await state();
  assert.ok(!runner.over && jumps > 0 && groundPassFrames > 0 && birdPassFrames > 0 && ducked, 'Runner must jump ground hazards and duck a generated flyer');
  report.games.runner = { score: runner.score, distance: runner.distance, over: runner.over, jumps, groundPassFrames, birdPassFrames, ducked };
  await screenshot('runner');

  await launch('road');
  let roadHops = 0, waits = 0, riverSeen = false, carry = 0;
  const mod = (n, d) => ((n % d) + d) % d;
  function objects(lane, time) { const xs = []; for (let x = mod(lane.phase + lane.speed * time, lane.period) - lane.period; x < 420 + lane.length; x += lane.period) xs.push(x); return xs; }
  function safe(lane, time, x) { return lane.kind === 'safe' || lane.kind === 'traffic' && !objects(lane, time).some(o => x + 11 > o && x - 11 < o + lane.length) || lane.kind === 'river' && objects(lane, time).some(o => x >= o + 12 && x <= o + lane.length - 12); }
  for (let i = 0; i < 3000; i++) {
    let road = await state(); if (road.over || road.row >= 12) break;
    const lane = road.lanes[road.row], next = road.lanes[road.row + 1];
    if (lane.kind === 'river') { riverSeen = true; const old = road.x; await step(8); road = await state(); carry += Math.abs(road.x - old); if (road.over) break; }
    if (road.hopCooldown > 0) { await step(1); continue; }
    if (safe(next, road.time + 1 / 60, road.x) && safe(next, road.time + .18, road.x)) { await page.keyboard.press('ArrowUp'); await step(1); roadHops++; }
    else { await step(1); waits++; }
  }
  const road = await state();
  assert.ok(!road.over && road.row >= 12 && road.score >= 110 && riverSeen && carry > 0 && road.camera > 0, 'Road must cross traffic and river, ride logs, and scroll');
  report.games.road = { row: road.row, score: road.score, over: road.over, reason: road.deathReason, hops: roadHops, waitFrames: waits, riverSeen, logCarryPixels: carry, camera: road.camera };
  await screenshot('road');

  await launch('breakout'); await page.keyboard.press('Space');
  let last = '', frames = 0, bounces = 0, prevVy = -1;
  for (let i = 0; i < 6000; i++) {
    const world = await state(); if (world.over) break;
    if (world.attached) await page.keyboard.press('Space');
    let target = world.ball.x;
    if (world.ball.vy > 0) { const time = (407 - world.ball.y) / world.ball.vy, projected = world.ball.x + world.ball.vx * Math.max(0, time), phase = mod(projected - 13, 788); target = 13 + (phase <= 394 ? phase : 788 - phase); }
    const key = target > world.paddleX + 5 ? 'ArrowRight' : target < world.paddleX - 5 ? 'ArrowLeft' : '';
    if (key !== last) { if (last) await page.keyboard.up(last); if (key) await page.keyboard.down(key); last = key; }
    if (world.ball.vy < 0 && prevVy > 0 && world.ball.y > 350) bounces++;
    prevVy = world.ball.vy; await step(1); frames++; if (world.score >= 150) break;
  }
  if (last) await page.keyboard.up(last);
  const played = await state();
  assert.ok(played.score >= 150 && !played.over && bounces > 0, 'Breakout keyboard paddle must destroy at least fifteen bricks');
  await screenshot('breakout');
  for (let i = 0; i < 1800; i++) {
    const world = await state(); if (world.lives < played.lives) break;
    const key = world.ball.x > 210 ? 'ArrowLeft' : 'ArrowRight'; await page.keyboard.down(key); await step(1); await page.keyboard.up(key);
  }
  const missed = await state(); assert.equal(missed.lives, played.lives - 1, 'Missing the ball costs one life'); assert.equal(missed.attached, true);
  await page.keyboard.press('Space'); await step(1); const relaunched = !(await state()).attached; assert.equal(relaunched, true);
  report.games.breakout = { score: played.score, lives: played.lives, over: played.over, level: played.level, remaining: played.bricks.filter(b => b.alive).length, frames, paddleBounces: bounces, afterIntentionalMiss: { lives: missed.lives, attached: missed.attached, score: missed.score }, relaunched };
  assert.deepEqual(errors, [], 'No uncaught errors or missing assets');
  writeFileSync(`${evidence}/exploratory.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
