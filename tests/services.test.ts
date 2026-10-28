import test from 'node:test';
import assert from 'node:assert/strict';
import { Records, RECORDS_KEY } from '../src/storage';
import { Input } from '../src/input';

class MemoryStore {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

test('records survive reload, separate modes and never lower a score', () => {
  const store = new MemoryStore();
  const records = new Records(store);
  records.save('snake', 'solo', 100);
  records.save('snake', 'solo', 25);
  records.save('snake', 'duo', 75);
  const loaded = new Records(store);
  assert.equal(loaded.best('snake', 'solo'), 100);
  assert.equal(loaded.best('snake', 'duo'), 75);
  assert.equal(loaded.best('maze', 'solo'), 0);
  assert.equal(JSON.parse(store.getItem(RECORDS_KEY)!).version, 1);
});

test('corrupt and invalid storage entries are ignored, valid entries recovered', () => {
  const store = new MemoryStore();
  store.setItem(RECORDS_KEY, '{broken');
  assert.equal(new Records(store).best('road', 'solo'), 0);
  store.setItem(RECORDS_KEY, JSON.stringify({ version: 1, scores: { road: { solo: 40, duo: -3 }, snake: { solo: '70' } } }));
  const records = new Records(store);
  assert.equal(records.best('road', 'solo'), 40);
  assert.equal(records.best('road', 'duo'), 0);
  assert.equal(records.best('snake', 'solo'), 0);
  records.save('road', 'solo', NaN);
  assert.equal(records.best('road', 'solo'), 40);
});

test('unavailable and full storage retain session records without throwing', () => {
  const missing = new Records(null);
  assert.equal(missing.available, false);
  missing.save('maze', 'solo', 240);
  assert.equal(missing.best('maze', 'solo'), 240);
  const throwing = new Records({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } });
  throwing.save('runner', 'duo', 50);
  assert.equal(throwing.available, false);
  assert.equal(throwing.best('runner', 'duo'), 50);
  const full = new Records({ getItem() { return null; }, setItem() { throw new Error('full'); } });
  full.save('road', 'solo', 20);
  assert.equal(full.best('road', 'solo'), 20);
  assert.equal(full.available, false);
});

test('saving merges higher records written by another tab', () => {
  const store = new MemoryStore();
  const first = new Records(store), second = new Records(store);
  first.save('breakout', 'solo', 300);
  second.save('snake', 'solo', 40);
  assert.equal(new Records(store).best('breakout', 'solo'), 300);
});

class FakeElement { closest() { return null; } }
class Key extends Event {
  code: string; repeat: boolean;
  constructor(code: string, repeat = false) { super('keydown', { cancelable: true }); this.code = code; this.repeat = repeat; }
}
function setupInput() {
  const events = new EventTarget();
  Object.defineProperty(globalThis, 'window', { value: events, configurable: true });
  Object.defineProperty(globalThis, 'Element', { value: FakeElement, configurable: true });
  const input = new Input(); input.active = true;
  const key = (code: string, repeat = false) => { const event = new Key(code, repeat); events.dispatchEvent(event); return event; };
  return { input, events, key };
}

test('simultaneous WASD/arrows are isolated; Space launches neither duo player', () => {
  const { input, key } = setupInput();
  key('KeyA'); key('ArrowRight'); key('Space');
  assert.deepEqual([...input.controls(0, 'duo', 'breakout').held], ['left']);
  assert.deepEqual([...input.controls(1, 'duo', 'breakout').held], ['right']);
  input.endTick();
  key('KeyW'); key('ArrowUp');
  assert(input.controls(0, 'duo', 'breakout').held.has('launch'));
  assert(input.controls(1, 'duo', 'breakout').held.has('launch'));
  input.destroy();
});

test('rapid edges retain order and OS repeat does not generate another jump', () => {
  const { input, key } = setupInput();
  key('KeyW'); key('KeyA');
  assert.deepEqual([...input.controls(0, 'solo', 'snake').pressed], ['up']);
  input.endTick();
  assert.deepEqual([...input.controls(0, 'solo', 'snake').pressed], ['left']);
  input.endTick(); input.clear();
  key('Space'); key('Space', true);
  assert(input.controls(0, 'solo', 'runner').pressed.has('jump'));
  input.endTick();
  assert.equal(input.controls(0, 'solo', 'runner').pressed.size, 0);
  input.destroy();
});

test('pause, blur, teardown and inactive menus clear or ignore held input', () => {
  const { input, events, key } = setupInput();
  assert.equal(key('ArrowUp').defaultPrevented, true);
  events.dispatchEvent(new Event('blur'));
  assert.equal(input.controls(0, 'solo', 'maze').held.size, 0);
  key('KeyD'); input.active = false;
  assert.equal(input.controls(0, 'solo', 'maze').held.size, 0);
  assert.equal(key('Space').defaultPrevented, false);
  input.destroy(); input.active = true; key('ArrowDown');
  assert.equal(input.controls(0, 'solo', 'maze').held.size, 0);
});


test('interactive controls retain normal keys while an active playfield blocks scrolling', () => {
  const { input, events } = setupInput();
  const focused = new FakeElement();
  focused.closest = () => focused as unknown as null;
  const event = new Key('Space');
  Object.defineProperty(event, 'target', { value: focused });
  events.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(input.controls(0, 'solo', 'runner').pressed.size, 0);
  input.destroy();
});
