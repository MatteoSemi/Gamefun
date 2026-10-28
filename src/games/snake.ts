import { backdrop, COLORS, label, rng, type Action, type Controls, type Game } from '../types';
export interface Cell {
    x: number;
    y: number;
}
export type Direction = 'up' | 'down' | 'left' | 'right';
const vectors: Record<Direction, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
export function emptyFood(snake: readonly Cell[], size: number, random: () => number): Cell | null {
    const occupied = new Set(snake.map(c => `${c.x},${c.y}`));
    const empty: Cell[] = [];
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
            if (!occupied.has(`${x},${y}`))
                empty.push({ x, y });
    return empty.length ? empty[Math.min(empty.length - 1, Math.floor(random() * empty.length))]! : null;
}
export class SnakeGame implements Game {
    readonly width = 420;
    readonly height = 460;
    readonly size = 20;
    score = 0;
    over = false;
    level = 1;
    won = false;
    snake: Cell[] = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
    direction: Direction = 'right';
    turns: Direction[] = [];
    food: Cell | null;
    private elapsed = 0;
    private random: () => number;
    constructor(seed: number) { this.random = rng(seed); this.food = emptyFood(this.snake, this.size, this.random); }
    get interval() { return Math.max(.07, .15 - Math.floor(this.score / 30) * .008); }
    enqueue(direction: Direction) {
        const previous = this.turns.at(-1) ?? this.direction;
        if (direction !== previous && direction !== opposite[previous] && this.turns.length < 2)
            this.turns.push(direction);
    }
    step() {
        if (this.over)
            return;
        this.direction = this.turns.shift() ?? this.direction;
        const d = vectors[this.direction], h = this.snake[0]!, next = { x: h.x + d.x, y: h.y + d.y };
        const eating = !!this.food && next.x === this.food.x && next.y === this.food.y;
        const body = eating ? this.snake : this.snake.slice(0, -1);
        if (next.x < 0 || next.y < 0 || next.x >= this.size || next.y >= this.size || body.some(p => p.x === next.x && p.y === next.y)) {
            this.over = true;
            return;
        }
        this.snake.unshift(next);
        if (eating) {
            this.score += 10;
            this.level = 1 + Math.floor(this.score / 50);
            this.food = emptyFood(this.snake, this.size, this.random);
            if (!this.food) {
                this.won = true;
                this.over = true;
            }
        }
        else
            this.snake.pop();
    }
    update(dt: number, input: Controls) {
        if (this.over)
            return;
        for (const key of input.pressed)
            if (key in vectors)
                this.enqueue(key as Direction);
        this.elapsed += dt;
        while (this.elapsed >= this.interval && !this.over) {
            this.elapsed -= this.interval;
            this.step();
        }
    }
    render(c: CanvasRenderingContext2D) {
        backdrop(c, this.width, this.height);
        c.strokeStyle = '#1a2740';
        c.lineWidth = 1;
        for (let i = 0; i <= this.size; i++) {
            c.beginPath();
            c.moveTo(10 + i * 20, 30);
            c.lineTo(10 + i * 20, 430);
            c.stroke();
            c.beginPath();
            c.moveTo(10, 30 + i * 20);
            c.lineTo(410, 30 + i * 20);
            c.stroke();
        }
        c.strokeStyle = COLORS.wall;
        c.lineWidth = 2;
        c.strokeRect(9, 29, 402, 402);
        if (this.food) {
            const x = 10 + this.food.x * 20, y = 30 + this.food.y * 20;
            c.fillStyle = COLORS.pink;
            c.fillRect(x + 4, y + 5, 12, 12);
            c.fillStyle = COLORS.gold;
            c.fillRect(x + 9, y + 2, 3, 5);
            c.fillStyle = '#fff';
            c.fillRect(x + 5, y + 6, 3, 3);
        }
        this.snake.forEach((p, i) => { const x = 10 + p.x * 20, y = 30 + p.y * 20; c.fillStyle = i === 0 ? COLORS.gold : COLORS.cyan; c.fillRect(x + 2, y + 2, 16, 16); c.fillStyle = '#18474c'; c.fillRect(x + 3, y + 14, 14, 3); if (!i) {
            c.fillStyle = COLORS.bg;
            const d = vectors[this.direction];
            if (d.x) {
                const ex = d.x > 0 ? 13 : 4;
                c.fillRect(x + ex, y + 5, 3, 3);
                c.fillRect(x + ex, y + 12, 3, 3);
            }
            else {
                const ey = d.y > 0 ? 13 : 4;
                c.fillRect(x + 5, y + ey, 3, 3);
                c.fillRect(x + 12, y + ey, 3, 3);
            }
        } });
        label(c, this.won ? 'GARDEN COMPLETE!' : 'GROW THE CIRCUIT', 210, 18, COLORS.muted, 11);
        label(c, `${this.snake.length} / 400 CELLS · ${Math.round(1 / this.interval)} STEPS / SEC`, 210, 451, COLORS.muted, 11);
    }
}
export const createSnake = (seed: number): Game => new SnakeGame(seed);
