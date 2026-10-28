import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMaze, createMaze, MAZE_COLS, MAZE_ROWS } from '../src/games/maze';
import type { Controls, Action } from '../src/types';
const input = (...keys: Action[]): Controls => ({ held: new Set(keys), pressed: new Set(keys) });
test('maze: every required pellet is reachable over a broad seed sample', () => {
    for (let seed = 0; seed < 40; seed++) {
        const walls = buildMaze(seed), seen = new Set(['1,19']), queue = [{ x: 1, y: 19 }];
        for (let i = 0; i < queue.length; i++)
            for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
                const p = { x: queue[i].x + dx, y: queue[i].y + dy }, k = `${p.x},${p.y}`;
                if (walls[p.y]?.[p.x] === false && !seen.has(k)) {
                    seen.add(k);
                    queue.push(p);
                }
            }
        const required = walls.flat().filter(x => !x).length;
        assert.equal(seen.size, required);
        assert.equal(walls.length, MAZE_ROWS);
        assert.equal(walls[0].length, MAZE_COLS);
    }
});
test('maze: buffered turns wait for a legal intersection and wall collision holds position', () => {
    const game = createMaze(23);
    // Construct a small L-shaped corridor in the existing public grid.
    for (let y = 1; y < 5; y++)
        for (let x = 1; x < 5; x++)
            game.walls[y][x] = true;
    for (const [x, y] of [[1, 1], [2, 1], [3, 1], [3, 2], [3, 3]])
        game.walls[y][x] = false;
    game.player = { x: 1, y: 1 };
    game.previous = { ...game.player };
    game.update(0.145, input('right'));
    assert.deepEqual(game.player, { x: 2, y: 1 });
    game.update(0.145, input('down'));
    assert.deepEqual(game.player, { x: 3, y: 1 });
    game.update(0.145, input());
    assert.deepEqual(game.player, { x: 3, y: 2 });
    game.update(0.145, input());
    assert.deepEqual(game.player, { x: 3, y: 3 });
    game.update(0.145, input());
    assert.deepEqual(game.player, { x: 3, y: 3 });
});
test('maze: power pellets award 50 and frightened enemies award 200 without costing a life', () => {
    const game = createMaze(2);
    game.protection = 0;
    game.player = { x: 2, y: 1 };
    game.previous = { ...game.player };
    game.walls[1][2] = false;
    game.ghosts[0].pos = { x: 1, y: 1 };
    game.ghosts[0].spawn = { x: 17, y: 1 };
    game.ghosts[1].pos = { x: 17, y: 19 };
    game.update(0.15, input('left'));
    assert.equal(game.score, 250);
    assert.equal(game.lives, 3);
    assert.ok(game.frightened > 0);
});
test('maze: three collisions end the run and all-pellet clear advances the round', () => {
    const game = createMaze(2);
    for (let death = 0; death < 3; death++) {
        game.protection = 0;
        game.ghosts[0].pos = { ...game.player };
        game.update(0.15, input());
    }
    assert.equal(game.lives, 0);
    assert.equal(game.over, true);
    const round = createMaze(2);
    round.pellets.clear();
    round.pellets.set('1,19', 10);
    round.update(0.15, input());
    assert.equal(round.level, 2);
    assert.equal(round.score, 10);
    assert.ok(round.pellets.size > 100);
});
test('maze: identical seeds have independent, equivalent layouts and state', () => {
    const a = createMaze(89), b = createMaze(89);
    assert.deepEqual(a.walls, b.walls);
    assert.deepEqual(a.pellets, b.pellets);
    a.update(0.5, input('up'));
    assert.equal(b.score, 0);
    assert.deepEqual(b.player, { x: 1, y: 19 });
});
