import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
declare global {
    interface Window {
        arcade: any;
    }
}
const ids = ['maze', 'snake', 'runner', 'road', 'breakout'];
async function launch(page: Page, id: string, duo = false) {
    await page.locator(`[data-game="${id}"]`).click();
    await expect(page.locator('dialog')).toBeVisible();
    await page.locator('#start').click();
    if (duo) {
        await page.locator('#multiplayer').click();
        await page.locator('[data-mode="duo"]').click();
        await page.locator('#mode-start').click();
    }
    await page.evaluate(() => window.arcade.step(181));
    await expect.poll(() => page.evaluate(() => window.arcade.session.phase)).toBe('running');
}
async function keyStep(page: Page, key: string, n = 12) { await page.keyboard.down(key); await page.evaluate(n => window.arcade.step(n), n); await page.keyboard.up(key); }
test.beforeEach(async ({ page }) => { await page.goto('/'); });
for (const id of ids) {
    test(`${id}: solo preview launches, assigned keyboard changes live world, restart and Home`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', e => errors.push(e.message));
        await launch(page, id);
        expect(await page.evaluate(() => window.arcade.session.id)).toBe(id);
        await expect(page.locator('.world')).toHaveCount(1);
        if (id === 'maze') {
            const move = await page.evaluate(() => { const w = window.arcade.session.worlds[0]; return [{ dx: 0, dy: -1, key: 'ArrowUp' }, { dx: 1, dy: 0, key: 'ArrowRight' }].find(d => !w.walls[w.player.y + d.dy][w.player.x + d.dx])!.key; });
            const before = await page.evaluate(() => JSON.stringify(window.arcade.session.worlds[0].player));
            await keyStep(page, move, 12);
            expect(await page.evaluate(() => JSON.stringify(window.arcade.session.worlds[0].player))).not.toBe(before);
        }
        else if (id === 'snake') {
            await keyStep(page, 'ArrowUp', 12);
            expect(await page.evaluate(() => window.arcade.session.worlds[0].direction)).toBe('up');
        }
        else if (id === 'runner') {
            await keyStep(page, 'Space', 8);
            expect(await page.evaluate(() => window.arcade.session.worlds[0].grounded)).toBe(false);
        }
        else if (id === 'road') {
            await keyStep(page, 'ArrowUp', 1);
            expect(await page.evaluate(() => window.arcade.session.worlds[0].score)).toBe(10);
        }
        else {
            await keyStep(page, 'Space', 12);
            expect(await page.evaluate(() => window.arcade.session.worlds[0].attached)).toBe(false);
        }
        await page.locator('#restart').click();
        expect(await page.evaluate(() => window.arcade.session.phase)).toBe('countdown');
        expect(await page.evaluate(() => window.arcade.session.worlds[0].score)).toBe(0);
        await page.locator('#home').click();
        await expect(page.locator('.card')).toHaveCount(5);
        expect(await page.evaluate(() => window.arcade.session)).toBeNull();
        expect(errors).toEqual([]);
    });
    test(`${id}: split screen simultaneous keys remain isolated, elimination and rematch`, async ({ page }) => {
        await launch(page, id, true);
        await expect(page.locator('.world')).toHaveCount(2);
        const before = await page.evaluate(() => window.arcade.session.worlds.map((w: any) => w.score));
        expect(before[0]).toBe(before[1]);
        const left = id === 'breakout' ? 'KeyD' : id === 'runner' ? 'KeyW' : 'KeyW';
        const right = id === 'breakout' ? 'ArrowLeft' : id === 'runner' ? 'ArrowDown' : 'ArrowRight';
        await page.keyboard.down(left);
        await page.keyboard.down(right);
        const actions = await page.evaluate(() => { const a = window.arcade; return [Array.from(a.input.controls(0, 'duo', a.session.id).held), Array.from(a.input.controls(1, 'duo', a.session.id).held)]; });
        expect(actions[0]).toEqual([id === 'breakout' ? 'right' : id === 'runner' ? 'jump' : 'up']);
        expect(actions[1]).toEqual([id === 'breakout' ? 'left' : id === 'runner' ? 'down' : 'right']);
        await page.evaluate(() => window.arcade.step(8));
        if (id === 'runner') {
            expect(await page.evaluate(() => window.arcade.session.worlds[0].grounded)).toBe(false);
            expect(await page.evaluate(() => window.arcade.session.worlds[1].ducking)).toBe(true);
        }
        if (id === 'road') {
            expect(await page.evaluate(() => window.arcade.session.worlds[0].score)).toBe(10);
            expect(await page.evaluate(() => window.arcade.session.worlds[1].score)).toBe(0);
        }
        await page.keyboard.up(left);
        await page.keyboard.up(right);
        // Deliberately finish a world, then run the actual coordinator to check freeze and survivor behavior.
        await page.evaluate(() => { const a = window.arcade; const s = a.session; s.worlds[0].score = 100; s.worlds[0].over = true; a.step(1); });
        expect(await page.evaluate(() => window.arcade.session.phase)).toBe('running');
        const frozen = await page.evaluate(() => window.arcade.session.worlds[0].score);
        await page.evaluate(() => window.arcade.step(10));
        expect(await page.evaluate(() => window.arcade.session.worlds[0].score)).toBe(frozen);
        expect(await page.evaluate(() => window.arcade.session.worlds[1].over)).toBe(false);
        await page.evaluate(() => { const a = window.arcade; a.session.worlds[1].score = 90; a.session.worlds[1].over = true; a.step(1); });
        await expect(page.locator('.match-result')).toContainText('Player 1 wins');
        await page.locator('#result-rematch').click();
        expect(await page.evaluate(() => window.arcade.session.worlds.map((w: any) => w.score))).toEqual([0, 0]);
        expect(await page.evaluate(() => window.arcade.session.phase)).toBe('countdown');
        await page.evaluate(() => { const a = window.arcade; a.step(181); a.session.worlds.forEach((w: any) => { w.score = 50; w.over = true; }); a.step(1); });
        await expect(page.locator('.match-result')).toContainText('Draw');
    });
}
test('dialogs pause, mode changes require explicit Start, focus loss and Escape deliberate resume', async ({ page }) => {
    await launch(page, 'runner');
    await page.locator('#rules').click();
    expect(await page.evaluate(() => window.arcade.session.phase)).toBe('paused');
    await expect(page.locator('dialog .rules-entry')).toHaveCount(5);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => window.arcade.session.phase)).toBe('paused');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => window.arcade.session.phase)).toBe('running');
    await page.locator('#multiplayer').click();
    await page.locator('[data-mode="duo"]').click();
    expect(await page.evaluate(() => window.arcade.session.mode)).toBe('solo');
    await page.locator('#mode-cancel').click();
    expect(await page.evaluate(() => window.arcade.session.mode)).toBe('solo');
    await page.locator('#pause').click();
    await page.keyboard.down('KeyW');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.keyboard.up('KeyW');
    expect(await page.evaluate(() => window.arcade.session.phase)).toBe('paused');
    expect(await page.evaluate(() => Array.from(window.arcade.input.controls(0, 'solo', 'runner').held))).toEqual([]);
    await page.locator('#pause').click();
    expect(await page.evaluate(() => window.arcade.session.phase)).toBe('running');
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', repeat: true })));
    expect(await page.evaluate(() => window.arcade.session.phase)).toBe('running');
    await page.locator('#multiplayer').click();
    await page.locator('[data-mode="duo"]').click();
    await page.locator('#mode-start').click();
    await expect(page.locator('.world')).toHaveCount(2);
    await page.locator('#multiplayer').click();
    await page.locator('[data-mode="solo"]').click();
    await page.locator('#mode-start').click();
    await expect(page.locator('.world')).toHaveCount(1);
});
test('records persist across refresh, modes separate, lower runs never decrease records, corrupt storage recovers', async ({ page }) => {
    await launch(page, 'road');
    await keyStep(page, 'ArrowUp', 1);
    await page.locator('#home').click();
    await page.reload();
    await expect(page.locator('[data-game="road"]')).toContainText('00010');
    await launch(page, 'road');
    await page.locator('#restart').click();
    await page.locator('#home').click();
    await page.reload();
    await expect(page.locator('[data-game="road"]')).toContainText('00010');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('phosphor-arcade.records.v1')!));
    expect(stored.version).toBe(1);
    expect(stored.scores.road.solo).toBe(10);
    expect(stored.scores.road.duo).toBe(0);
    await page.evaluate(() => localStorage.setItem('phosphor-arcade.records.v1', '{broken'));
    await page.reload();
    await launch(page, 'road');
    await keyStep(page, 'ArrowUp', 1);
    expect(await page.evaluate(() => window.arcade.records.best('road', 'solo'))).toBe(10);
});
test('unavailable storage explains session fallback and gameplay continues', async ({ page }) => {
    await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }); });
    await page.reload();
    await expect(page.locator('#storage-notice')).toBeVisible();
    await launch(page, 'road');
    await keyStep(page, 'ArrowUp', 1);
    await expect(page.locator('.best')).toHaveText('00010');
    await page.locator('#home').click();
    await expect(page.locator('[data-game="road"]')).toContainText('00010');
});
test('keyboard menu activation, rapid inputs, repeated navigation and responsive play', async ({ page }) => {
    await page.locator('[data-game="snake"]').focus();
    await page.keyboard.press('Enter');
    await page.locator('#start').click();
    await page.evaluate(() => window.arcade.step(181));
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowLeft');
    await page.evaluate(() => window.arcade.step(18));
    expect(await page.evaluate(() => window.arcade.session.worlds[0].direction)).toBe('left');
    for (let i = 0; i < 4; i++) {
        await page.locator('#restart').click();
        await page.evaluate(() => window.arcade.step(181));
        await page.locator('#home').click();
        await launch(page, 'snake', true);
        await page.locator('#home').click();
        await launch(page, 'snake');
    }
    await page.locator('#multiplayer').click();
    await page.locator('[data-mode="duo"]').click();
    await page.locator('#mode-start').click();
    await page.setViewportSize({ width: 560, height: 900 });
    const sizes = await page.locator('.world canvas').evaluateAll(cs => cs.map(c => { const r = c.getBoundingClientRect(); const cv = c as HTMLCanvasElement; return { ratio: r.width / r.height, native: cv.width / cv.height, right: r.right }; }));
    expect(sizes).toHaveLength(2);
    for (const s of sizes) {
        expect(Math.abs(s.ratio - s.native)).toBeLessThan(.01);
        expect(s.right).toBeLessThanOrEqual(560);
    }
});
test('offline external-blocked app loads and all games play without missing assets or uncaught errors', async ({ page }) => {
    const errors: string[] = [];
    const external: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400)
        errors.push(`${r.status()} ${r.url()}`); });
    await page.route('**/*', route => { if (new URL(route.request().url()).hostname === 'localhost')
        return route.continue(); external.push(route.request().url()); return route.abort(); });
    await page.reload();
    for (const id of ids) {
        for (const duo of [false, true]) {
            await launch(page, id, duo);
            await keyStep(page, id === 'breakout' ? (duo ? 'KeyW' : 'Space') : (duo ? 'KeyW' : 'ArrowUp'), 5);
            await page.locator('#home').click();
        }
    }
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
});
test('capture representative home, rulebook, solo and split-screen gameplay', async ({ page }) => {
    await mkdir('evidence', { recursive: true });
    await page.screenshot({ path: 'evidence/home.png', fullPage: true });
    await page.locator('#book').click();
    await page.screenshot({ path: 'evidence/rulebook.png', fullPage: true });
    await page.locator('#close-dialog').click();
    await launch(page, 'maze');
    await keyStep(page, 'ArrowUp', 12);
    await page.screenshot({ path: 'evidence/solo-maze.png', fullPage: true });
    await page.locator('#home').click();
    await launch(page, 'runner', true);
    await page.keyboard.down('KeyW');
    await page.keyboard.down('ArrowDown');
    await page.evaluate(() => window.arcade.step(10));
    await page.keyboard.up('KeyW');
    await page.keyboard.up('ArrowDown');
    await page.screenshot({ path: 'evidence/split-screen.png', fullPage: true });
});
test('high DPI canvas backing stores preserve geometry at device scale factor two', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1024, height: 900 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto('http://localhost:5173');
    await launch(page, 'road', true);
    const dimensions = await page.locator('.world canvas').evaluateAll(cs => cs.map(c => { const cv = c as HTMLCanvasElement; const box = cv.getBoundingClientRect(); return { width: cv.width, height: cv.height, ratio: box.width / box.height }; }));
    for (const cv of dimensions) {
        expect(cv.width).toBe(840);
        expect(cv.height).toBe(924);
        expect(cv.ratio).toBeCloseTo(420 / 462, 2);
    }
    await context.close();
});
