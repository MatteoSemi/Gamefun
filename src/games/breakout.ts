import { backdrop, COLORS, label, rng, type Controls, type Game } from '../types';
export interface Brick {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    alive: boolean;
}
export interface Sweep {
    time: number;
    nx: number;
    ny: number;
}
/** Segment versus a radius-expanded rectangle. Returns entry normals (both at a corner). */
export function sweepRect(x: number, y: number, dx: number, dy: number, left: number, top: number, right: number, bottom: number): Sweep | null {
    let tx0 = -Infinity, tx1 = Infinity, ty0 = -Infinity, ty1 = Infinity;
    if (Math.abs(dx) < 1e-10) {
        if (x < left || x > right)
            return null;
    }
    else {
        const a = (left - x) / dx, b = (right - x) / dx;
        tx0 = Math.min(a, b);
        tx1 = Math.max(a, b);
    }
    if (Math.abs(dy) < 1e-10) {
        if (y < top || y > bottom)
            return null;
    }
    else {
        const a = (top - y) / dy, b = (bottom - y) / dy;
        ty0 = Math.min(a, b);
        ty1 = Math.max(a, b);
    }
    const entry = Math.max(tx0, ty0), exit = Math.min(tx1, ty1);
    if (entry > exit + 1e-9 || exit < 0 || entry < -1e-8 || entry > 1)
        return null;
    return { time: Math.max(0, entry), nx: Math.abs(tx0 - entry) < 1e-8 ? (dx > 0 ? -1 : 1) : 0, ny: Math.abs(ty0 - entry) < 1e-8 ? (dy > 0 ? -1 : 1) : 0 };
}
export class BreakoutGame implements Game {
    readonly width = 420;
    readonly height = 460;
    score = 0;
    over = false;
    lives = 3;
    level = 1;
    paddleX = 210;
    readonly paddleWidth = 80;
    readonly paddleY = 412;
    readonly radius = 5;
    ball = { x: 210, y: 401, vx: 0, vy: 0 };
    attached = true;
    bricks: Brick[] = [];
    private random: () => number;
    constructor(seed: number) { this.random = rng(seed); this.fill(); }
    get speed() { return Math.min(490, 270 + (this.level - 1) * 28); }
    private fill() { this.bricks = []; for (let row = 0; row < 5; row++)
        for (let col = 0; col < 9; col++)
            this.bricks.push({ x: 17 + col * 43, y: 48 + row * 24, w: 39, h: 17, color: ['#ff6eab', '#b196ff', '#ffda79', '#ffae79', '#69f6e1'][row], alive: true }); }
    private attach() { this.attached = true; this.ball = { x: this.paddleX, y: this.paddleY - this.radius - 2, vx: 0, vy: 0 }; }
    update(dt: number, input: Controls) {
        if (this.over)
            return;
        const time = Math.min(.1, dt);
        const direction = Number(input.held.has('right')) - Number(input.held.has('left'));
        this.paddleX = Math.max(8 + this.paddleWidth / 2, Math.min(this.width - 8 - this.paddleWidth / 2, this.paddleX + direction * 370 * time));
        if (this.attached) {
            this.ball.x = this.paddleX;
            this.ball.y = this.paddleY - this.radius - 2;
            if (!input.pressed.has('launch'))
                return;
            this.attached = false;
            const angle = (this.random() > .5 ? 1 : -1) * .25;
            this.ball.vx = this.speed * Math.sin(angle);
            this.ball.vy = -this.speed * Math.cos(angle);
        }
        let remaining = time;
        // Swept collisions use the entire travel segment, so no brick can be skipped at high speed.
        for (let iteration = 0; iteration < 16 && remaining > 1e-7; iteration++) {
            const b = this.ball, dx = b.vx * remaining, dy = b.vy * remaining, r = this.radius;
            type Hit = Sweep & {
                brick?: Brick;
                paddle?: boolean;
            };
            const hits: Hit[] = [];
            const wall = (t: number, nx: number, ny: number) => { if (t >= -1e-8 && t <= 1)
                hits.push({ time: Math.max(0, t), nx, ny }); };
            if (dx < 0)
                wall((8 + r - b.x) / dx, 1, 0);
            if (dx > 0)
                wall((412 - r - b.x) / dx, -1, 0);
            if (dy < 0)
                wall((24 + r - b.y) / dy, 0, 1);
            if (dy > 0 && b.y <= this.paddleY - r + .01) {
                const h = sweepRect(b.x, b.y, dx, dy, this.paddleX - this.paddleWidth / 2 - r, this.paddleY - r, this.paddleX + this.paddleWidth / 2 + r, this.paddleY + 10 + r);
                if (h)
                    hits.push({ ...h, paddle: true });
            }
            for (const brick of this.bricks) {
                if (!brick.alive)
                    continue;
                const h = sweepRect(b.x, b.y, dx, dy, brick.x - r, brick.y - r, brick.x + brick.w + r, brick.y + brick.h + r);
                if (h)
                    hits.push({ ...h, brick });
            }
            if (!hits.length) {
                b.x += dx;
                b.y += dy;
                break;
            }
            const nearest = Math.min(...hits.map(h => h.time));
            const contact = hits.filter(h => Math.abs(h.time - nearest) < 1e-7);
            b.x += dx * nearest;
            b.y += dy * nearest;
            let nx = 0, ny = 0;
            for (const h of contact) {
                nx = h.nx || nx;
                ny = h.ny || ny;
                if (h.brick && h.brick.alive) {
                    h.brick.alive = false;
                    this.score += 10;
                }
            }
            if (contact.some(h => h.paddle)) {
                const offset = Math.max(-1, Math.min(1, (b.x - this.paddleX) / (this.paddleWidth / 2)));
                const angle = offset * 1.08;
                b.vx = this.speed * Math.sin(angle);
                b.vy = -this.speed * Math.cos(angle);
                b.y = this.paddleY - r - .02;
            }
            else {
                if (nx)
                    b.vx = -b.vx;
                if (ny)
                    b.vy = -b.vy;
                b.x += nx * .02;
                b.y += ny * .02;
            }
            remaining *= 1 - nearest;
        }
        if (this.ball.y > this.height + this.radius) {
            this.lives--;
            if (!this.lives)
                this.over = true;
            else
                this.attach();
        }
        if (!this.over && !this.bricks.some(b => b.alive)) {
            this.level++;
            this.fill();
            this.attach();
        }
    }
    render(c: CanvasRenderingContext2D) {
        backdrop(c, this.width, this.height);
        c.strokeStyle = '#1c2743';
        c.lineWidth = 1;
        for (let x = 16; x < 420; x += 24) {
            c.beginPath();
            c.moveTo(x, 24);
            c.lineTo(x, 449);
            c.stroke();
        }
        for (let y = 24; y < 449; y += 24) {
            c.beginPath();
            c.moveTo(8, y);
            c.lineTo(412, y);
            c.stroke();
        }
        c.fillStyle = '#353765';
        c.fillRect(4, 20, 4, 430);
        c.fillRect(412, 20, 4, 430);
        c.fillRect(4, 20, 412, 4);
        for (const brick of this.bricks) {
            if (!brick.alive)
                continue;
            c.fillStyle = brick.color;
            c.fillRect(brick.x, brick.y, brick.w, brick.h);
            c.fillStyle = '#ffffff45';
            c.fillRect(brick.x + 1, brick.y + 1, brick.w - 2, 3);
            c.fillStyle = '#0003';
            c.fillRect(brick.x, brick.y + brick.h - 3, brick.w, 3);
        }
        c.fillStyle = COLORS.cyan;
        c.fillRect(this.paddleX - this.paddleWidth / 2, this.paddleY, this.paddleWidth, 9);
        c.fillStyle = '#c5fff3';
        c.fillRect(this.paddleX - this.paddleWidth / 2 + 3, this.paddleY, this.paddleWidth - 6, 2);
        c.fillStyle = '#46767b';
        c.fillRect(this.paddleX - 4, this.paddleY + 2, 8, 5);
        c.fillStyle = '#fff4c9';
        c.fillRect(Math.round(this.ball.x) - 4, Math.round(this.ball.y) - 4, 8, 8);
        label(c, `PRISM ARRAY / ROUND ${this.level}`, 210, 13, COLORS.muted, 10);
        label(c, this.attached && !this.over ? 'LAUNCH TO BREAK THE SPECTRUM' : `${this.bricks.filter(b => b.alive).length} BRICKS REMAIN`, 210, 447, this.attached ? COLORS.gold : COLORS.muted, 10);
    }
}
export const createBreakout = (seed: number): BreakoutGame => new BreakoutGame(seed);
