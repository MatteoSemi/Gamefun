import test from 'node:test';
import assert from 'node:assert/strict';
import { BreakoutGame, sweepRect } from '../src/games/breakout';
import type { Controls, Action } from '../src/types';
const input = (held: Action[] = [], pressed: Action[] = []): Controls => ({ held: new Set(held), pressed: new Set(pressed) });
const spare = { x: 20, y: 50, w: 39, h: 17, color: '#fff', alive: true };
test('breakout launch stays attached until edge and seeded launch is repeatable', () => { const a = new BreakoutGame(42), b = new BreakoutGame(42); a.update(1 / 60, input(['right'])); assert.equal(a.ball.x, a.paddleX); assert.equal(a.attached, true); a.paddleX = 210; a.update(1 / 60, input([], ['launch'])); b.update(1 / 60, input([], ['launch'])); assert.equal(a.attached, false); assert.deepEqual(a.ball, b.ball); });
test('swept brick collision prevents high speed tunneling and scores exactly once', () => { const g = new BreakoutGame(1); g.bricks = [{ ...spare, x: 190, y: 150 }, { ...spare }]; g.attached = false; g.ball = { x: 210, y: 270, vx: 0, vy: -4000 }; g.update(.05, input()); assert.equal(g.score, 10); assert.equal(g.bricks[0].alive, false); assert.ok(g.ball.vy > 0); g.update(.01, input()); assert.equal(g.score, 10); });
test('exact corner collision reflects both axes, and parallel ray misses', () => { assert.deepEqual(sweepRect(0, 0, 20, 20, 10, 10, 30, 30), { time: .5, nx: -1, ny: -1 }); assert.equal(sweepRect(0, 0, 0, 20, 10, 10, 30, 30), null); const g = new BreakoutGame(1); g.bricks = [{ ...spare, x: 100, y: 100, w: 20, h: 20 }, { ...spare }]; g.attached = false; g.ball = { x: 85, y: 85, vx: 1000, vy: 1000 }; g.update(.015, input()); assert.ok(g.ball.vx < 0 && g.ball.vy < 0); assert.equal(g.score, 10); });
test('paddle position controls rebound angle with upward component and no sticking', () => { const a = new BreakoutGame(1), b = new BreakoutGame(1); for (const [g, x] of [[a, 180], [b, 240]] as const) {
    g.attached = false;
    g.ball = { x, y: 395, vx: 0, vy: 350 };
    g.update(.05, input());
    assert.ok(g.ball.vy < 0);
    assert.ok(g.ball.y < g.paddleY - g.radius);
} assert.ok(a.ball.vx < 0); assert.ok(b.ball.vx > 0); });
test('ball loss costs one life and requires relaunch; third loss ends run', () => { const g = new BreakoutGame(1); for (let life = 2; life >= 0; life--) {
    g.attached = false;
    g.ball = { x: 210, y: 470, vx: 0, vy: 300 };
    g.update(.01, input());
    assert.equal(g.lives, life);
    assert.equal(g.over, life === 0);
    if (life)
        assert.equal(g.attached, true);
} const score = g.score; g.update(1, input([], ['launch'])); assert.equal(g.score, score); });
test('last brick advances round, resets ball, retains lives and caps speed', () => { const g = new BreakoutGame(1); g.bricks = [{ ...spare, x: 190, y: 150 }]; g.attached = false; g.ball = { x: 210, y: 180, vx: 0, vy: -300 }; g.update(.1, input()); assert.equal(g.level, 2); assert.equal(g.score, 10); assert.equal(g.lives, 3); assert.equal(g.attached, true); assert.equal(g.bricks.filter(b => b.alive).length, 45); g.level = 100; assert.equal(g.speed, 490); });
test('wall corner at high speed stays in bounds and produces finite state', () => { const g = new BreakoutGame(1); g.attached = false; g.ball = { x: 20, y: 36, vx: -3000, vy: -3000 }; g.update(.05, input()); assert.ok(g.ball.x >= 13 && g.ball.x <= 407); assert.ok(g.ball.y >= 29); assert.ok(Number.isFinite(g.ball.x + g.ball.y)); });
