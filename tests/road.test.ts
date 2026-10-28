import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoad, laneObjects, laneSupports, type Lane } from '../src/games/road';
import type { Action, Controls } from '../src/types';
const keys = (...actions: Action[]): Controls => ({ held: new Set(actions), pressed: new Set(actions) });
const empty = keys();
function hop(g: ReturnType<typeof createRoad>, action: Action) { g.hopCooldown = 0; g.update(1 / 60, keys(action)); }

test('road starts with safe space and independent identical seeded lanes', () => {
  const a = createRoad(74), b = createRoad(74);
  assert.deepEqual(a.lanes, b.lanes);
  assert.ok(a.lanes.slice(0, 3).every(l => l.kind === 'safe'));
  hop(a, 'up'); assert.equal(a.score, 10); assert.equal(b.score, 0); assert.equal(b.row, 1);
});
test('forward rows score once and backwards hops cannot farm points', () => {
  const g = createRoad(3); hop(g, 'up'); assert.equal(g.score, 10);
  hop(g, 'down'); hop(g, 'up'); assert.equal(g.score, 10);
});
test('generator keeps safe banks, traversable gaps and capped speed', () => {
  const g = createRoad(19);
  g.row = 900; g.update(1 / 60, empty);
  assert.ok(g.lanes.every(l => Math.abs(l.speed) <= 105));
  assert.ok(g.lanes.filter(l => l.kind === 'traffic').every(l => l.period - l.length >= 100));
  assert.ok(g.lanes.filter(l => l.kind === 'river').every(l => l.length >= 3 * 35 && l.period - l.length <= 50));
  let hazards = 0;
  for (const lane of g.lanes) { hazards = lane.kind === 'safe' ? 0 : hazards + 1; assert.ok(hazards <= 3); }
});
test('log support carries player with lane; leaving support drowns', () => {
  const g = createRoad(2); const lane = g.lanes.find(l => l.kind === 'river')!;
  g.row = lane.row;
  g.x = laneObjects(lane, 0).find(x => x >= 0)! + 40;
  const x = g.x; assert.ok(laneSupports(lane, 0, x));
  g.update(1 / 60, empty); assert.equal(g.over, false); assert.equal(g.x, x + lane.speed / 60);
  g.x = laneObjects(lane, g.time).find(x => x >= 0)! + lane.length + 24;
  g.update(1 / 60, empty); assert.equal(g.over, true); assert.equal(g.lives, 0);
});
test('traffic collision ends run, a gap remains safe', () => {
  const g = createRoad(9); const lane = g.lanes.find(l => l.kind === 'traffic')!;
  g.row = lane.row; g.x = laneObjects(lane, 0).find(x => x >= 0)! + lane.length / 2;
  g.update(1 / 60, empty); assert.equal(g.over, true);
  const safe = createRoad(9); const l = safe.lanes[lane.row]; safe.row = l.row;
  safe.x = laneObjects(l, 0).find(x => x >= 0)! + l.length + 40;
  safe.update(1 / 60, empty); assert.equal(safe.over, false);
});
test('wrapped lane objects preserve support across periods', () => {
  const l: Lane = { row: 5, kind: 'river', phase: 151, speed: 30, length: 105, period: 155 };
  assert.equal(laneSupports(l, 0, 20), true);
  assert.equal(laneSupports(l, 0, 120), false);
});
