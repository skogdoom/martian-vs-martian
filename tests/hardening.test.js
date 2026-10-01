import { describe, it, expect } from 'vitest';
import { STEP, ARENA, SAUCER, RESTOCK } from '../src/config.js';
import { createWorld, stepWorld } from '../src/logic/world.js';

function run(w, inputs, seconds) {
  for (let t = 0; t < seconds - 1e-9; t += STEP) stepWorld(w, inputs, STEP);
}

describe('safety net against NaN', () => {
  it('a saucer at NaN goes back to its start instead of spreading NaN', () => {
    const w = createWorld(1);
    w.saucers.red.x = NaN;
    w.saucers.blue.vy = Infinity;
    stepWorld(w, {}, STEP);
    expect(w.saucers.red).toMatchObject({ x: SAUCER.startX.red, y: SAUCER.startY, vx: 0, vy: 0 });
    expect(w.saucers.blue).toMatchObject({ x: SAUCER.startX.blue, vy: 0 });
    run(w, { red: { x: 1, y: 0 } }, 1);
    expect(Number.isFinite(w.saucers.red.x)).toBe(true);
  });

  it('an animal at NaN is taken out, even out of a beam', () => {
    const w = createWorld(1);
    const lamb = w.animals.find((a) => a.kind === 'lamb');
    Object.assign(w.saucers.red, { x: lamb.x, y: ARENA.flightBottom - 10, vx: 0, vy: 0 });
    w.saucers.blue.y = 100;
    stepWorld(w, {}, STEP);
    expect(w.hooks.red.target).toBe(lamb);
    lamb.x = NaN; // (a NaN y heals itself here: the lift rewrites it)
    stepWorld(w, {}, STEP);
    expect(lamb.state).toBe('gone');
    expect(w.hooks.red.target).toBe(null);
    run(w, {}, 2);
    expect(w.animals.filter((a) => a !== lamb).every((a) => Number.isFinite(a.x) && Number.isFinite(a.y))).toBe(true);
  });

  it('a projectile at NaN is dropped', () => {
    const w = createWorld(1);
    stepWorld(w, { red: { x: 0, y: 0, shoot: true } }, STEP);
    expect(w.projectiles).toHaveLength(1);
    w.projectiles[0].x = NaN;
    stepWorld(w, {}, STEP);
    stepWorld(w, {}, STEP);
    expect(w.projectiles).toHaveLength(0);
  });
});

describe('herd cap', () => {
  it('no field restock while the cap is reached', () => {
    const w = createWorld(1);
    w.saucers.red.y = w.saucers.blue.y = 100;
    // Fill both pens well past the cap.
    while (w.animals.length < RESTOCK.maxAlive) w.animals.push({ ...w.animals[0], id: `extra-${w.animals.length}` });
    w.animals.forEach((a, i) => Object.assign(a, { state: 'penned', pen: i % 2 ? 'red' : 'blue', owner: i % 2 ? 'red' : 'blue', vx: 0 }));
    let restocks = 0;
    for (let t = 0; t < RESTOCK.emptyFieldAfter * 2; t += STEP) {
      stepWorld(w, {}, STEP);
      restocks += w.events.filter((e) => e.type === 'restock').length;
    }
    expect(restocks).toBe(0);
  });
});
