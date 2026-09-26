import { describe, it, expect, afterEach } from 'vitest';
import { STEP, ARENA, POWERUP, RESTOCK } from '../src/config.js';
import { createWorld, stepWorld, spawnDrop } from '../src/logic/world.js';
import { createRound } from '../src/logic/round.js';
import { canHook } from '../src/logic/hook.js';

const LOW = ARENA.flightBottom - 10;
const saved = { mystery: POWERUP.mysteryChance, chance: POWERUP.chance };
afterEach(() => {
  POWERUP.mysteryChance = saved.mystery;
  POWERUP.chance = saved.chance;
});

function stepUntil(w, inputs, seconds, pred) {
  for (let t = 0; t < seconds; t += STEP) {
    stepWorld(w, inputs, STEP);
    const e = w.events.find(pred);
    if (e) return e;
  }
  return null;
}

function place(s, x, y) {
  Object.assign(s, { x, y, vx: 0, vy: 0 });
}

describe('mystery package', () => {
  it('about one drop in five', () => {
    POWERUP.chance = 1;
    let mystery = 0;
    let total = 0;
    for (let seed = 1; seed <= 500; seed++) {
      for (const d of createRound(seed).drops) {
        total++;
        if (d.mystery) mystery++;
      }
    }
    expect(mystery / total).toBeGreaterThan(0.15);
    expect(mystery / total).toBeLessThan(0.25);
  });

  it('hides the power-up until grabbed, then grants it', () => {
    const w = createWorld(2);
    place(w.saucers.red, 300, 100);
    place(w.saucers.blue, 1000, 100);
    spawnDrop(w, 'laser', true);
    expect(w.events.find((e) => e.type === 'dropIncoming')).toMatchObject({ mystery: true, power: null });
    const p = w.drops[0];
    expect(p.kind).toBe('package');
    stepUntil(w, {}, 10, (e) => e.type === 'dropLanded');
    const x = p.x;
    stepUntil(w, {}, 2, () => false);
    expect(p.x).toBe(x); // a package doesn't walk
    place(w.saucers.red, p.x, LOW);
    expect(stepUntil(w, {}, 2, (e) => e.type === 'powerup')).toMatchObject({ side: 'red', power: 'laser', mystery: true });
    expect(p.state).toBe('gone');
    expect(w.powers.red.type).toBe('laser');
  });
});

describe('drops within reach', () => {
  it('are grabbed before a nearer animal', () => {
    const w = createWorld(2);
    place(w.saucers.blue, 1000, 100);
    const lamb = w.animals.find((a) => a.kind === 'lamb');
    spawnDrop(w, 'speed', true);
    const p = w.drops[0];
    stepUntil(w, {}, 10, (e) => e.type === 'dropLanded');
    Object.assign(lamb, { x: p.x + 4, vx: 0, wanderTimer: 99 });
    place(w.saucers.red, p.x + 6, LOW); // nearer the lamb than the package
    stepWorld(w, {}, STEP);
    expect(w.hooks.red.target).toBe(p);
  });
});

describe('restocking the herd', () => {
  it('parachutes in new animals when every one has splatted', () => {
    const w = createWorld(2);
    const herd = w.animals.slice();
    herd.slice(1).forEach((a) => (a.state = 'gone'));
    stepWorld(w, {}, STEP);
    expect(w.events.some((e) => e.type === 'restock')).toBe(false); // one still alive
    herd[0].state = 'gone';
    stepWorld(w, {}, STEP);
    expect(w.events.find((e) => e.type === 'restock')).toMatchObject({ count: RESTOCK.count });
    const fresh = w.animals.slice(herd.length);
    expect(fresh).toHaveLength(RESTOCK.count);
    for (const a of fresh) {
      expect(['cow', 'lamb']).toContain(a.kind);
      expect(a.state).toBe('descending');
    }
    // Only once while they are on their way down.
    stepWorld(w, {}, STEP);
    expect(w.animals).toHaveLength(herd.length + RESTOCK.count);
    // They land in the field and can be picked up.
    stepUntil(w, {}, 10, () => fresh.every((a) => a.state === 'field'));
    for (const a of fresh) {
      expect(a.x).toBeGreaterThan(ARENA.pens.red.right);
      expect(a.x).toBeLessThan(ARENA.pens.blue.left);
    }
    expect(canHook({ ...w.saucers.red, x: fresh[0].x, y: LOW }, fresh[0])).toBe(true);
  });

  it('does not restock while animals are alive in pens', () => {
    const w = createWorld(2);
    w.animals.forEach((a, i) => (a.state = i === 0 ? 'penned' : 'gone'));
    w.animals[0].pen = 'red';
    stepWorld(w, {}, STEP);
    expect(w.events.some((e) => e.type === 'restock')).toBe(false);
  });
});
