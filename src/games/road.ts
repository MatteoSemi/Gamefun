import { backdrop, COLORS, label, rng, type Action, type Controls, type Game } from '../types';
export const ROAD_CELL = 35;
export const ROAD_ROW = 42;
export type LaneKind = 'safe' | 'traffic' | 'river';
export interface Lane {
    row: number;
    kind: LaneKind;
    speed: number;
    phase: number;
    length: number;
    period: number;
}
const mod = (n: number, d: number) => ((n % d) + d) % d;
/** One repeating object position, plus its wrapped neighbours. */
export function laneObjects(lane: Lane, time: number, width = 420): number[] {
    const first = mod(lane.phase + lane.speed * time, lane.period) - lane.period;
    const result: number[] = [];
    for (let x = first; x < width + lane.length; x += lane.period)
        result.push(x);
    return result;
}
export function laneSupports(lane: Lane, time: number, centerX: number): boolean {
    return laneObjects(lane, time).some(x => centerX >= x + 6 && centerX <= x + lane.length - 6);
}
/** Endless crossing: generated lanes have wide gaps and no static barriers. */
export class RoadGame implements Game {
    readonly width = 420;
    readonly height = 462;
    score = 0;
    over = false;
    lives = 1;
    level = 1;
    x = 210;
    row = 1;
    bestRow = 1;
    camera = 0;
    time = 0;
    hopCooldown = 0;
    hopFlash = 0;
    deathReason = '';
    readonly lanes: Lane[] = [];
    private random: () => number;
    constructor(seed: number) {
        this.random = rng(seed);
        this.ensureLanes(22);
    }
    private ensureLanes(upTo: number) {
        while (this.lanes.length <= upTo) {
            const row = this.lanes.length;
            // Three safe starting rows, then safe banks at least every three hazards.
            const phase = (row - 3) % 9;
            const kind: LaneKind = row < 3 || phase === 0 || phase === 4 || phase === 8 ? 'safe' : phase < 4 ? 'traffic' : 'river';
            const direction = row % 2 ? 1 : -1;
            const difficulty = Math.min(9, Math.floor(row / 12));
            this.lanes.push({ row, kind,
                speed: kind === 'safe' ? 0 : direction * (kind === 'traffic' ? 42 + difficulty * 7 : 25 + difficulty * 3),
                phase: this.random() * 240,
                length: kind === 'traffic' ? 42 + Math.floor(this.random() * 2) * 14 : 105,
                period: kind === 'traffic' ? 182 : 155,
            });
        }
    }
    private lose(reason: string) { this.deathReason = reason; this.over = true; this.lives = 0; }
    update(dt: number, input: Controls) {
        if (this.over)
            return;
        // Called at 60 Hz by the shell; clamp defensive direct simulation calls too.
        const step = Math.min(dt, 0.05);
        this.ensureLanes(this.row + 18);
        const standing = this.lanes[this.row];
        if (standing.kind === 'river')
            this.x += standing.speed * step;
        this.time += step;
        this.hopCooldown = Math.max(0, this.hopCooldown - step);
        this.hopFlash = Math.max(0, this.hopFlash - step);
        if (this.hopCooldown <= 0) {
            const directions: Action[] = ['up', 'down', 'left', 'right'];
            const action = directions.find(a => input.pressed.has(a)) ?? directions.find(a => input.held.has(a));
            if (action) {
                if (action === 'up')
                    this.row++;
                if (action === 'down')
                    this.row = Math.max(Math.ceil(this.camera), this.row - 1);
                if (action === 'left')
                    this.x = Math.max(ROAD_CELL / 2, this.x - ROAD_CELL);
                if (action === 'right')
                    this.x = Math.min(this.width - ROAD_CELL / 2, this.x + ROAD_CELL);
                this.hopCooldown = 0.16;
                this.hopFlash = 0.12;
            }
        }
        this.ensureLanes(this.row + 18);
        this.bestRow = Math.max(this.bestRow, this.row);
        this.score = (this.bestRow - 1) * 10;
        this.level = 1 + Math.floor((this.bestRow - 1) / 12);
        // Camera never scrolls backwards, so returning over the same rows never scores.
        this.camera = Math.max(this.camera, this.row - 5);
        const lane = this.lanes[this.row];
        if (this.x < 8 || this.x > this.width - 8) {
            this.lose('SWEPT OFF THE BANK');
            return;
        }
        if (lane.kind === 'traffic' && laneObjects(lane, this.time).some(x => this.x + 10 > x && this.x - 10 < x + lane.length))
            this.lose('TRAFFIC COLLISION');
        if (lane.kind === 'river' && !laneSupports(lane, this.time, this.x))
            this.lose('MISSED THE LOG');
    }
    render(c: CanvasRenderingContext2D) {
        backdrop(c, this.width, this.height);
        const low = Math.floor(this.camera);
        for (let row = low; row <= low + 12; row++) {
            const lane = this.lanes[row];
            if (!lane)
                continue;
            const y = this.height - (row - this.camera + 1) * ROAD_ROW;
            if (lane.kind === 'safe') {
                c.fillStyle = row < 3 ? '#214936' : '#294f44';
                c.fillRect(0, y, this.width, ROAD_ROW);
                c.fillStyle = '#3e6d52';
                for (let x = 0; x < this.width; x += 35) {
                    c.fillRect(x + (row % 2) * 8, y + 6, 3, 5);
                    c.fillRect(x + 18, y + 29, 4, 3);
                }
                if (row === 1)
                    label(c, 'START', 50, y + 26, '#8bab82', 11);
            }
            else if (lane.kind === 'traffic') {
                c.fillStyle = '#202439';
                c.fillRect(0, y, this.width, ROAD_ROW);
                c.fillStyle = '#7d7553';
                for (let x = 0; x < this.width; x += 45)
                    c.fillRect(x, y + ROAD_ROW - 2, 22, 2);
                for (const x of laneObjects(lane, this.time)) {
                    c.fillStyle = lane.speed > 0 ? COLORS.pink : '#9b8cff';
                    c.fillRect(x, y + 9, lane.length, 26);
                    c.fillStyle = '#18233b';
                    c.fillRect(x + 9, y + 12, lane.length - 21, 19);
                    c.fillStyle = '#accadd';
                    c.fillRect(lane.speed > 0 ? x + lane.length - 14 : x + 5, y + 13, 8, 17);
                    c.fillStyle = COLORS.gold;
                    c.fillRect(lane.speed > 0 ? x + lane.length - 3 : x, y + 12, 3, 6);
                    c.fillStyle = '#070c19';
                    c.fillRect(x + 7, y + 6, 10, 4);
                    c.fillRect(x + 7, y + 35, 10, 4);
                    c.fillRect(x + lane.length - 17, y + 6, 10, 4);
                    c.fillRect(x + lane.length - 17, y + 35, 10, 4);
                }
            }
            else {
                c.fillStyle = '#123b58';
                c.fillRect(0, y, this.width, ROAD_ROW);
                c.fillStyle = '#22627a';
                for (let x = -30; x < this.width; x += 49)
                    c.fillRect(x + mod(this.time * 12, 49), y + 7 + (row % 2) * 8, 19, 2);
                for (const x of laneObjects(lane, this.time)) {
                    c.fillStyle = '#916342';
                    c.fillRect(x, y + 6, lane.length, 31);
                    c.fillStyle = '#c38b56';
                    c.fillRect(x + 4, y + 6, lane.length - 8, 4);
                    c.fillStyle = '#5a4038';
                    c.fillRect(x + 8, y + 17, lane.length - 16, 3);
                    c.fillRect(x + 19, y + 27, lane.length - 32, 2);
                }
            }
        }
        const y = this.height - (this.row - this.camera + 0.5) * ROAD_ROW - (this.hopFlash > 0 ? 3 : 0);
        c.fillStyle = '#0006';
        c.fillRect(this.x - 13, y + 10, 26, 7);
        c.fillStyle = this.over ? COLORS.pink : COLORS.gold;
        c.fillRect(this.x - 11, y - 10, 22, 22);
        c.fillRect(this.x - 16, y + 4, 7, 11);
        c.fillRect(this.x + 9, y + 4, 7, 11);
        c.fillRect(this.x - 13, y - 15, 8, 9);
        c.fillRect(this.x + 5, y - 15, 8, 9);
        c.fillStyle = '#112737';
        c.fillRect(this.x - 9, y - 11, 4, 4);
        c.fillRect(this.x + 5, y - 11, 4, 4);
        c.fillRect(this.x - 5, y + 6, 10, 3);
        if (this.over) {
            c.fillStyle = '#090e21d9';
            c.fillRect(0, 188, this.width, 75);
            label(c, this.deathReason, 210, 231, COLORS.pink, 17);
        }
    }
}
export const createRoad = (seed: number): RoadGame => new RoadGame(seed);
