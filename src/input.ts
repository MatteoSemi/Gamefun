import type { Action, Controls, GameId } from './types';

type Mode = 'solo' | 'duo';
const RECOGNIZED = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
const WASD: Record<string, Action> = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
const ARROWS: Record<string, Action> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

/** One input service, with independent logical bindings and queued key edges per player. */
export class Input {
  private enabled = false;
  private keys = new Set<string>();
  private queue: string[] = [];
  private consumed = new Set<number>();
  private tickMode: Mode = 'solo';
  private tickGame: GameId = 'maze';

  constructor() {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.clear);
  }

  get active(): boolean { return this.enabled; }
  set active(value: boolean) { if (!value) this.clear(); this.enabled = value; }

  private interactive(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest('dialog, input, textarea, select, button, a[href], summary, [contenteditable="true"]');
  }

  private onDown = (event: KeyboardEvent) => {
    if (!this.enabled || !RECOGNIZED.has(event.code) || this.interactive(event.target)) return;
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
    if (event.repeat || this.keys.has(event.code)) return;
    this.keys.add(event.code);
    if (this.queue.length < 32) this.queue.push(event.code);
  };

  private onUp = (event: KeyboardEvent) => { this.keys.delete(event.code); };

  private map(code: string, player: 0 | 1, mode: Mode, game: GameId): Action | undefined {
    const base = mode === 'solo' ? WASD[code] ?? ARROWS[code] : (player === 0 ? WASD[code] : ARROWS[code]);
    if (game === 'runner') {
      if (base === 'up' || (mode === 'solo' && code === 'Space')) return 'jump';
      return base === 'down' ? 'down' : undefined;
    }
    if (game === 'breakout') {
      if ((mode === 'solo' && code === 'Space') || (mode === 'duo' && base === 'up')) return 'launch';
      return base === 'left' || base === 'right' ? base : undefined;
    }
    return base;
  }

  controls(player: 0 | 1, mode: Mode, game: GameId): Controls {
    this.tickMode = mode;
    this.tickGame = game;
    const held = new Set<Action>();
    const pressed = new Set<Action>();
    for (const key of this.keys) {
      const action = this.map(key, player, mode, game);
      if (action) held.add(action);
    }
    // Keep chronological edges so a fast up/left sequence survives until two ticks.
    for (let i = 0; i < this.queue.length; i++) {
      const action = this.map(this.queue[i], player, mode, game);
      if (!action) continue;
      pressed.add(action);
      this.consumed.add(i);
      break;
    }
    return { held, pressed };
  }

  endTick(): void {
    this.queue = this.queue.filter((key, index) => !this.consumed.has(index) && !!(this.map(key, 0, this.tickMode, this.tickGame) || (this.tickMode === 'duo' && this.map(key, 1, this.tickMode, this.tickGame))));
    this.consumed.clear();
  }

  clear = (): void => { this.keys.clear(); this.queue.length = 0; this.consumed.clear(); };

  destroy(): void {
    this.clear();
    this.enabled = false;
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.clear);
  }
}
