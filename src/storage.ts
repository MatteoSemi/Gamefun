import type { GameId } from './types';

export const RECORDS_KEY = 'phosphor-arcade.records.v1';
type Mode = 'solo' | 'duo';
type Scores = Record<GameId, Record<Mode, number>>;
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const IDS: GameId[] = ['maze', 'snake', 'runner', 'road', 'breakout'];
const validScore = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const blank = (): Scores => Object.fromEntries(IDS.map(id => [id, { solo: 0, duo: 0 }])) as Scores;

/** Persistent bests are advisory: storage errors never interrupt an arcade run. */
export class Records {
  available = true;
  private storage: Store | null;
  private scores = blank();

  constructor(storage?: Store | null) {
    if (storage === undefined) {
      try { this.storage = typeof window === 'undefined' ? null : window.localStorage; }
      catch { this.storage = null; }
    } else this.storage = storage;
    this.available = this.storage !== null;
    this.read();
  }

  private read() {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(RECORDS_KEY);
      if (!raw) return;
      let decoded: unknown;
      try { decoded = JSON.parse(raw); }
      catch { return; } // Ignore damaged data and repair it on the next score save.
      if (!decoded || typeof decoded !== 'object') return;
      const record = decoded as { version?: unknown; scores?: unknown };
      if (record.version !== 1 || !record.scores || typeof record.scores !== 'object') return;
      const scores = record.scores as Record<string, unknown>;
      for (const id of IDS) {
        const entry = scores[id];
        if (!entry || typeof entry !== 'object') continue;
        for (const mode of ['solo', 'duo'] as const) {
          const value = (entry as Record<string, unknown>)[mode];
          if (validScore(value)) this.scores[id][mode] = Math.max(this.scores[id][mode], Math.floor(value));
        }
      }
    } catch { this.fail(); }
  }

  private fail() { this.available = false; this.storage = null; }

  best(id: GameId, mode: Mode): number { return this.scores[id][mode]; }

  save(id: GameId, mode: Mode, score: number): void {
    if (!validScore(score)) return;
    this.read(); // Merge a higher score saved by another tab before writing.
    const value = Math.floor(score);
    this.scores[id][mode] = Math.max(this.scores[id][mode], value);
    if (!this.storage) return;
    try { this.storage.setItem(RECORDS_KEY, JSON.stringify({ version: 1, scores: this.scores })); }
    catch { this.fail(); }
  }
}
