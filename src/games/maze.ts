import { backdrop, COLORS, label, rng, type Action, type Controls, type Game } from '../types';

export const MAZE_COLS = 19;
export const MAZE_ROWS = 21;
const TILE = 20;
const OX = 20;
const OY = 20;
type Direction = 'up' | 'down' | 'left' | 'right';
type Cell = { x: number; y: number };
const DELTAS: Record<Direction, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const DIRECTIONS = Object.keys(DELTAS) as Direction[];
const OPPOSITE: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
const key = (p: Cell) => `${p.x},${p.y}`;
const isDirection = (a: Action): a is Direction => a in DELTAS;

/** Seeded carving creates a connected original maze, then adds loops for escape routes. */
export function buildMaze(seed: number): boolean[][] {
  const random = rng(seed);
  const walls = Array.from({ length: MAZE_ROWS }, () => Array<boolean>(MAZE_COLS).fill(true));
  const stack: Cell[] = [{ x: 1, y: 1 }];
  walls[1][1] = false;
  while (stack.length) {
    const p = stack[stack.length - 1];
    const options = DIRECTIONS.map(d => ({ x: p.x + DELTAS[d].x * 2, y: p.y + DELTAS[d].y * 2 }))
      .filter(n => n.x > 0 && n.y > 0 && n.x < MAZE_COLS - 1 && n.y < MAZE_ROWS - 1 && walls[n.y][n.x]);
    if (!options.length) { stack.pop(); continue; }
    const n = options[Math.floor(random() * options.length)];
    walls[(p.y + n.y) / 2][(p.x + n.x) / 2] = false;
    walls[n.y][n.x] = false;
    stack.push(n);
  }
  for (let y = 1; y < MAZE_ROWS - 1; y++) for (let x = 1; x < MAZE_COLS - 1; x++) {
    if (walls[y][x] && ((x % 2 === 0 && y % 2 === 1) || (x % 2 === 1 && y % 2 === 0)) && random() < 0.48) walls[y][x] = false;
  }
  return walls;
}

export interface Ghost {
  pos: Cell; prev: Cell; spawn: Cell; dir: Direction | null; clock: number; returning: number; color: string;
}
export class MazeGame implements Game {
  readonly width = 420;
  readonly height = 460;
  score = 0;
  over = false;
  lives = 3;
  level = 1;
  readonly walls: boolean[][];
  pellets = new Map<string, number>();
  player: Cell = { x: 1, y: 19 };
  previous: Cell = { ...this.player };
  direction: Direction | null = null;
  wanted: Direction | null = null;
  playerClock = 0;
  elapsed = 0;
  frightened = 0;
  protection = 1.8;
  ghosts: Ghost[];
  private random: () => number;
  private roundReady = 0;

  constructor(seed: number) {
    this.random = rng(seed ^ 0x51ca77);
    this.walls = buildMaze(seed);
    const spawns = [{ x: 17, y: 1 }, { x: 1, y: 1 }, { x: 17, y: 19 }];
    this.ghosts = spawns.map((spawn, i) => ({ pos: { ...spawn }, prev: { ...spawn }, spawn, dir: null, clock: 0, returning: 0, color: ['#ff6eab', '#69f6e1', '#ffad69'][i] }));
    this.fillPellets();
    this.pellets.delete(key(this.player));
  }
  walkable(p: Cell): boolean { return this.walls[p.y]?.[p.x] === false; }
  private fillPellets() {
    this.pellets.clear();
    for (let y = 0; y < MAZE_ROWS; y++) for (let x = 0; x < MAZE_COLS; x++) if (!this.walls[y][x]) this.pellets.set(`${x},${y}`, 10);
    for (const p of [{ x: 1, y: 1 }, { x: 17, y: 1 }, { x: 1, y: 19 }, { x: 17, y: 19 }]) this.pellets.set(key(p), 50);
  }
  private respawn() {
    this.player = { x: 1, y: 19 }; this.previous = { ...this.player };
    this.direction = null; this.wanted = null; this.playerClock = 0;
    this.frightened = 0; this.protection = 1.8;
    this.ghosts.forEach(g => { g.pos = { ...g.spawn }; g.prev = { ...g.spawn }; g.clock = 0; g.dir = null; g.returning = 0; });
  }
  private neighbor(p: Cell, d: Direction): Cell { return { x: p.x + DELTAS[d].x, y: p.y + DELTAS[d].y }; }
  private collect() {
    const value = this.pellets.get(key(this.player));
    if (value === undefined) return;
    this.pellets.delete(key(this.player)); this.score += value;
    if (value === 50) this.frightened = Math.max(4, 8 - (this.level - 1) * 0.4);
    if (this.pellets.size === 0) {
      this.level++; this.fillPellets(); this.respawn(); this.roundReady = 1.2;
    }
  }
  private collision(): boolean {
    if (this.protection > 0) return false;
    for (const ghost of this.ghosts) {
      if (ghost.returning > 0 || !same(this.player, ghost.pos)) continue;
      if (this.frightened > 0) {
        this.score += 200; ghost.pos = { ...ghost.spawn }; ghost.prev = { ...ghost.spawn }; ghost.dir = null; ghost.returning = 1.2;
      } else {
        this.lives--; if (this.lives <= 0) this.over = true; else this.respawn();
        return true;
      }
    }
    return false;
  }
  /** Breadth-first distance makes pursuit follow corridors rather than push into walls. */
  private distanceMap(target: Cell): Map<string, number> {
    const queue = [target]; const distances = new Map<string, number>([[key(target), 0]]);
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      for (const d of DIRECTIONS) { const n = this.neighbor(p, d); if (this.walkable(n) && !distances.has(key(n))) { distances.set(key(n), distances.get(key(p))! + 1); queue.push(n); } }
    }
    return distances;
  }
  update(dt: number, input: Controls) {
    if (this.over) return;
    for (const action of input.pressed) if (isDirection(action)) this.wanted = action;
    if (this.wanted === null) for (const action of input.held) if (isDirection(action)) this.wanted = action;
    if (this.roundReady > 0) { this.roundReady = Math.max(0, this.roundReady - dt); return; }
    this.elapsed += dt; this.frightened = Math.max(0, this.frightened - dt); this.protection = Math.max(0, this.protection - dt);
    const playerPeriod = 1 / Math.min(9, 7 + (this.level - 1) * 0.3);
    this.playerClock += dt;
    while (this.playerClock >= playerPeriod && !this.over) {
      this.playerClock -= playerPeriod;
      this.previous = { ...this.player };
      if (this.wanted && this.walkable(this.neighbor(this.player, this.wanted))) this.direction = this.wanted;
      if (this.direction) { const next = this.neighbor(this.player, this.direction); if (this.walkable(next)) this.player = next; }
      this.collect();
      if (this.collision() || this.roundReady > 0) return;
    }
    const scatter = this.elapsed % 24 < 7;
    const distances = !scatter && !this.frightened ? this.distanceMap(this.player) : null;
    for (let i = 0; i < this.ghosts.length; i++) {
      const g = this.ghosts[i];
      if (g.returning > 0) { g.returning = Math.max(0, g.returning - dt); continue; }
      const speed = this.frightened > 0 ? 3.5 : Math.min(7.2, 4.6 + i * 0.15 + (this.level - 1) * 0.35);
      g.clock += dt;
      while (g.clock >= 1 / speed) {
        g.clock -= 1 / speed; g.prev = { ...g.pos };
        let options = DIRECTIONS.filter(d => this.walkable(this.neighbor(g.pos, d)));
        if (options.length > 1 && g.dir) options = options.filter(d => d !== OPPOSITE[g.dir!]);
        if (!options.length) break;
        if (this.frightened > 0) g.dir = options[Math.floor(this.random() * options.length)];
        else {
          const target = scatter ? [{ x: 17, y: 1 }, { x: 1, y: 1 }, { x: 17, y: 19 }][i] : this.player;
          const map = distances ?? this.distanceMap(target);
          options.sort((a, b) => (map.get(key(this.neighbor(g.pos, a))) ?? 999) - (map.get(key(this.neighbor(g.pos, b))) ?? 999));
          // The orange sentry scatters whenever too close; others directly pursue.
          g.dir = i === 2 && !scatter && Math.abs(g.pos.x - this.player.x) + Math.abs(g.pos.y - this.player.y) < 4 ? options[options.length - 1] : options[0];
        }
        g.pos = this.neighbor(g.pos, g.dir);
        if (this.collision()) return;
      }
    }
  }
  render(c: CanvasRenderingContext2D) {
    backdrop(c, this.width, this.height);
    c.lineWidth = 1;
    for (let y = 0; y < MAZE_ROWS; y++) for (let x = 0; x < MAZE_COLS; x++) {
      const px = OX + x * TILE, py = OY + y * TILE;
      if (this.walls[y][x]) { c.fillStyle = '#252c62'; c.fillRect(px + 1, py + 1, TILE - 2, TILE - 2); c.strokeStyle = COLORS.wall; c.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5); }
      else {
        const pellet = this.pellets.get(`${x},${y}`);
        if (pellet) { c.fillStyle = pellet === 50 ? COLORS.pink : '#ffda79'; const size = pellet === 50 ? 8 : 3; c.fillRect(px + (TILE - size) / 2, py + (TILE - size) / 2, size, size); }
      }
    }
    const playerPeriod = 1 / Math.min(9, 7 + (this.level - 1) * 0.3);
    const fraction = Math.min(1, this.playerClock / playerPeriod);
    const px = OX + (this.previous.x + (this.player.x - this.previous.x) * fraction + 0.5) * TILE;
    const py = OY + (this.previous.y + (this.player.y - this.previous.y) * fraction + 0.5) * TILE;
    c.fillStyle = COLORS.gold;
    c.beginPath();
    const angle = this.direction === 'left' ? Math.PI : this.direction === 'up' ? -Math.PI / 2 : this.direction === 'down' ? Math.PI / 2 : 0;
    c.moveTo(px, py); c.arc(px, py, 8, angle + 0.25, angle + Math.PI * 2 - 0.25); c.closePath(); c.fill();
    if (this.protection > 0) { c.strokeStyle = COLORS.cyan; c.strokeRect(px - 10.5, py - 10.5, 21, 21); }
    this.ghosts.forEach((g, i) => {
      const speed = this.frightened > 0 ? 3.5 : Math.min(7.2, 4.6 + i * 0.15 + (this.level - 1) * 0.35);
      const fraction = Math.min(1, g.clock * speed);
      const x = OX + (g.prev.x + (g.pos.x - g.prev.x) * fraction) * TILE + 2;
      const y = OY + (g.prev.y + (g.pos.y - g.prev.y) * fraction) * TILE + 2;
      c.globalAlpha = g.returning > 0 ? 0.35 : 1;
      c.fillStyle = this.frightened > 0 ? '#7278ee' : g.color;
      c.fillRect(x + 3, y, 10, 3); c.fillRect(x, y + 3, 16, 11); c.fillRect(x, y + 14, 4, 2); c.fillRect(x + 6, y + 14, 4, 2); c.fillRect(x + 12, y + 14, 4, 2);
      c.fillStyle = '#090e21'; c.fillRect(x + 3, y + 5, 3, 4); c.fillRect(x + 10, y + 5, 3, 4);
      if (this.frightened > 0) { c.fillStyle = '#fff'; c.fillRect(x + 4, y + 11, 8, 1); }
      c.globalAlpha = 1;
    });
    label(c, this.roundReady > 0 ? `ROUND ${this.level}` : this.frightened > 0 ? `POWER ${Math.ceil(this.frightened)}s · GHOST +200` : this.elapsed % 24 < 7 ? 'GHOSTS: SCATTER' : 'GHOSTS: PURSUIT', this.width / 2, 454, this.frightened > 0 ? COLORS.cyan : COLORS.muted, 10);
  }
}
export const createMaze = (seed: number): MazeGame => new MazeGame(seed);
